import { AMOUNT, AMOUNT_BOUNDARY, AMOUNT_START, RANGE_SEPARATOR, parseAmounts } from "./amount";
import { matchIngredient, type IngredientMatch } from "./densities";
import { formatCount, formatMetric } from "./format";
import { FLUID_OUNCE_ML, UNIT, unitOf, type Dimension, type Unit } from "./units";

export type LineOptions = { scale: number; metric: boolean; locale?: string };

/**
 * A piece of a line to swap out: `text` replaces `line.slice(start, end)`. `original`
 * is what the tooltip shows when it isn't the piece itself, or null for no tooltip.
 */
export type Replacement = { start: number; end: number; text: string; original?: string | null };

/**
 * An amount (or range) as written: one value, or both ends of a range. The amount
 * itself ends at `amountEnd`, and its unit starts at `unitStart`.
 */
type Quantity = { start: number; end: number; amountEnd: number; unitStart: number; amounts: number[]; unit: Unit };

/**
 * A quantity in metric. `whole` amounts are exact, so they're shown in whole units;
 * `metric` ones were written in metric to begin with; a `packageSize` ("2 (14 oz) cans")
 * stays the same when the recipe is scaled, since the count changes instead.
 */
type Measure = {
  start: number;
  end: number;
  values: number[];
  dimension: Dimension;
  whole: boolean;
  metric: boolean;
  packageSize: boolean;
};

/** A number of things with no unit, as in "3 eggs": one value, or both ends of a range. */
type Count = { start: number; end: number; values: number[] };

/**
 * A measure to write into the line over `start`–`end`. A metric amount the site gave
 * alongside imperial carries its own text, which is shown as written. A piece that
 * stands for more than its own text (`joined`) shows the whole line as its tooltip;
 * a `removed` one is the site's metric amount, already shown elsewhere in the line.
 */
type Piece = { start: number; end: number; measure: Measure; siteText?: string; joined?: true; removed?: true };

// The unit may be hyphenated on, as in "a 15-ounce can".
const QUANTITY = new RegExp(
  String.raw`${AMOUNT_BOUNDARY}(${AMOUNT})(?:(?:${RANGE_SEPARATOR})(${AMOUNT}))?\s*-?\s*(${UNIT})`,
  "dgi",
);

// Anything number-like before a unit. Each must be part of a readable quantity, or the
// line has an amount we can't read and stays as written rather than half-converted.
const LOOSE_QUANTITY = new RegExp(
  String.raw`${AMOUNT_START}(?:${AMOUNT_START}|[.,/⁄\s–—-])*?\s*(?:${UNIT})`,
  "gi",
);

// A number with no unit: not part of a word, a size ("8-inch", "9x13"), a percentage
// or a temperature.
const COUNT = new RegExp(
  String.raw`${AMOUNT_BOUNDARY}(${AMOUNT})(?:(?:${RANGE_SEPARATOR})(${AMOUNT}))?(?![\w%°º″"'×]|\s*[x×]\s*\d|\s*-\s*\w)`,
  "gi",
);

// A count that runs into the package size after it: "2" in "2 15-oz cans".
const COUNT_BEFORE_PACKAGE = new RegExp(String.raw`^(?:${AMOUNT})\s+$`);

// What joins the parts of a compound amount, as in "1 cup plus 2 tbsp".
const COMPOUND_JOIN = /^\s*(?:\+|plus)\s*$/i;

// What sits between a count and its package size: "2 (14 oz) cans", "1 15-oz can",
// "1 can (14 oz)". Other words in between ("3 eggs (150 g)") give a total instead.
const PACKAGE_JOIN =
  /^\s*(?:\(|(?:cans?|tins?|jars?|packages?|pkgs?\.?|packets?|bottles?|box(?:es)?|bags?|cartons?|containers?|blocks?)\s*\()?\s*$/i;

export function findReplacements(line: string, options: LineOptions): Replacement[] {
  if (!options.metric) return scaleAsWritten(line, options);
  const scaling = options.scale !== 1;
  const quantities = findQuantities(line);
  if (!quantities) return [];
  const counts = scaling ? findCounts(line, quantities) : [];
  if (!counts) return [];
  const measures = toMetric(quantities, matchIngredient(nameOf(line, quantities)));
  if (!measures) return [];
  markPackageSizes(line, counts, measures);
  const combined = combineCompounds(line, measures);
  if (!scaling && combined.every((measure) => measure.metric)) return [];
  // Unscaled, a metric amount apart from the imperial one means the line is fine as it
  // is; scaled, every amount in it has to change.
  const pieces = pairWithSiteMetric(line, combined, scaling);
  if (!pieces) return [];

  const measured = pieces.map(({ start, end, measure, siteText, joined, removed }): Replacement => {
    if (removed) return { start, end, text: "", original: null };
    const scale = measure.packageSize ? 1 : options.scale;
    const text =
      siteText !== undefined && scale === 1
        ? siteText
        : formatMetric(
            measure.values.map((value) => value * scale),
            measure.dimension,
            { locale: options.locale, whole: measure.whole },
          );
    return joined ? { start, end, text, original: line.trim() } : { start, end, text };
  });
  return [...measured, ...scaleCounts(counts, options)].sort((a, b) => a.start - b.start);
}

/** Whether a line has an amount to convert or scale: exactly when scaling changes it. */
export function hasAmount(line: string): boolean {
  return scaleAsWritten(line, { scale: 2, metric: false }).length > 0;
}

/**
 * With metric off, scales the amounts in the units they're written in: imperial ones as
 * common fractions ("1½ cups"), metric ones rounded like a conversion would be.
 */
function scaleAsWritten(line: string, options: LineOptions): Replacement[] {
  if (options.scale === 1) return [];
  const quantities = findQuantities(line);
  if (!quantities) return [];
  const counts = findCounts(line, quantities);
  if (!counts) return [];
  const packageSizes = packageSizesAmong(line, counts, quantities);

  const scaled = quantities
    .filter((quantity) => !packageSizes.has(quantity))
    .map(({ start, end, amountEnd, unitStart, amounts, unit }): Replacement => {
      const values = amounts.map((amount) => amount * options.scale);
      if (unit.metric) {
        const text = formatMetric(
          values.map((value) => value * unit.size),
          unit.dimension,
          { locale: options.locale },
        );
        return { start, end, text };
      }
      const count = formatCount(values, options.locale);
      const between = line.slice(amountEnd, unitStart);
      const unitText = line.slice(unitStart, end);
      // A hyphenated unit describes something else and stays singular: "a 30-ounce can".
      const text = count + between + (between.includes("-") ? unitText : inflect(unitText, isPlural(count)));
      return { start, end, text };
    });
  return [...scaled, ...scaleCounts(counts, options)].sort((a, b) => a.start - b.start);
}

function scaleCounts(counts: Count[], options: LineOptions): Replacement[] {
  return counts.map(({ start, end, values }) => ({
    start,
    end,
    text: formatCount(
      values.map((value) => value * options.scale),
      options.locale,
    ),
  }));
}

// Unit words that change with the amount; abbreviations ("tbsp", "oz") don't.
const UNIT_WORD = /(cup|spoon|ounce|pound|pint|quart|gallon|stick)s?$/i;

function inflect(unit: string, plural: boolean): string {
  return unit.replace(UNIT_WORD, (_, word: string) => word + (plural ? "s" : ""));
}

/** Whether a formatted count takes a plural unit: "1½ cups" does; "1 cup", "½ cup" and "½–1 cup" don't. */
function isPlural(count: string): boolean {
  const high = count.split("–").at(-1)!;
  return high !== "1" && /\d/.test(high);
}

/**
 * The counts in a line: numbers outside quantities and parentheses, like "3" in
 * "3 large eggs" or "2" in "2 (14 oz) cans". Null when one of them can't be read.
 */
function findCounts(line: string, quantities: Quantity[]): Count[] | null {
  const counts: Count[] = [];
  for (const match of line.matchAll(COUNT)) {
    const start = match.index;
    const end = start + match[0].length;
    if (quantities.some((q) => q.start < end && start < q.end) || insideParentheses(line, start)) continue;
    const values = parseAmounts(match[1]!, match[2]);
    if (!values) return null;
    if (values.every((value) => value > 0)) counts.push({ start, end, values });
  }
  return counts;
}

function insideParentheses(line: string, index: number): boolean {
  let depth = 0;
  for (const char of line.slice(0, index)) {
    if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

/** A measure right after a count is the size of each package, not an amount to scale. */
function markPackageSizes(line: string, counts: Count[], measures: Measure[]): void {
  for (const measure of packageSizesAmong(line, counts, measures)) measure.packageSize = true;
}

/** The amounts in a line that are package sizes, as in "2 (14 oz) cans". */
function packageSizesAmong<T extends { start: number }>(line: string, counts: Count[], amounts: T[]): Set<T> {
  const sizes = new Set<T>();
  for (const count of counts) {
    const next = amounts.find((amount) => amount.start >= count.end);
    if (next && PACKAGE_JOIN.test(line.slice(count.end, next.start))) sizes.add(next);
  }
  return sizes;
}

// How two amounts for the same thing sit together: "1 cup (120 g)", "200 g / 7 oz".
const PAIR_OPEN = /^\s*[([]\s*$/;
const PAIR_CLOSE = /^\s*[)\]]/;
const PAIR_SLASH = /^\s*\/\s*$/;

/**
 * Joins amounts given twice for the same thing so one figure replaces both: the site's
 * metric amount when there is one ("1 cup (120 g)", either order), otherwise the first
 * ("1 cup (2 sticks)"). A metric amount elsewhere in the line ("1 cup sugar (200 g)")
 * stands in for the line's only imperial amount and is removed from where it was.
 * Null when a metric amount can't be placed like that, unless `keepUnpaired` keeps it
 * as a piece of its own.
 */
function pairWithSiteMetric(line: string, measures: Measure[], keepUnpaired: boolean): Piece[] | null {
  const pieces: Piece[] = [];
  for (let i = 0; i < measures.length; i++) {
    const first = measures[i]!;
    const second = measures[i + 1];
    const end = second && !(first.metric && second.metric) ? pairEnd(line, first, second) : null;
    if (end !== null) {
      const kept = second!.metric ? second! : first;
      const siteText = kept.metric ? line.slice(kept.start, kept.end) : undefined;
      pieces.push({ start: first.start, end, measure: kept, ...(siteText !== undefined && { siteText }), joined: true });
      i++;
    } else {
      pieces.push({ start: first.start, end: first.end, measure: first });
    }
  }

  const loose = pieces.filter((piece) => piece.measure.metric && !piece.joined);
  if (loose.length === 0) return pieces;
  const imperial = pieces.filter((piece) => !piece.measure.metric && !piece.joined);
  const parenthetical = loose.length === 1 && imperial.length === 1 ? enclosingParentheses(line, loose[0]!.measure) : null;
  if (parenthetical && pieces.every((piece) => piece === loose[0] || piece.end <= parenthetical.start || piece.start >= parenthetical.end)) {
    const metric = loose[0]!.measure;
    const target = imperial[0]!;
    return pieces
      .map((piece): Piece => {
        if (piece === target) return { ...target, measure: metric, siteText: line.slice(metric.start, metric.end), joined: true };
        if (piece === loose[0]) return { ...parenthetical, measure: metric, removed: true };
        return piece;
      })
      .sort((a, b) => a.start - b.start);
  }
  return keepUnpaired ? pieces : null;
}

/** Where a pair of amounts written side by side ends, or null when they aren't a pair. */
function pairEnd(line: string, first: Measure, second: Measure): number | null {
  const between = line.slice(first.end, second.start);
  if (PAIR_SLASH.test(between)) return second.end;
  const close = line.slice(second.end).match(PAIR_CLOSE);
  return PAIR_OPEN.test(between) && close ? second.end + close[0].length : null;
}

/** The parentheses around a measure, with the space before them, as in " (about 120 g)". */
function enclosingParentheses(line: string, measure: Measure): { start: number; end: number } | null {
  const open = line.lastIndexOf("(", measure.start);
  const close = line.indexOf(")", measure.end);
  if (open === -1 || close === -1 || line.slice(open, measure.start).includes(")") || line.slice(measure.end, close).includes("(")) {
    return null;
  }
  let start = open;
  while (start > 0 && /\s/.test(line[start - 1]!)) start--;
  return { start, end: close + 1 };
}

/**
 * Whether a recipe's ingredient lines are already metric: they give metric amounts
 * and no US customary ones besides spoons, which metric cooks use as they are.
 */
export function isMetricRecipe(lines: string[]): boolean {
  const units = lines.flatMap((line) => findQuantities(line) ?? []).map((quantity) => quantity.unit);
  return units.some((unit) => unit.metric) && units.every((unit) => unit.metric || unit.spoon);
}

/** The line without its quantities: what's left names the ingredient. */
function nameOf(line: string, quantities: Quantity[]): string {
  let name = "";
  let cursor = 0;
  for (const { start, end } of quantities) {
    name += line.slice(cursor, start) + " ";
    cursor = end;
  }
  return name + line.slice(cursor);
}

/**
 * Converts each quantity to metric: dry ingredients by weight, "oz" of a liquid by
 * volume. Null when a quantity only makes sense for another ingredient (sticks).
 */
function toMetric(quantities: Quantity[], ingredient: IngredientMatch): Measure[] | null {
  const measures: Measure[] = [];
  for (const { start, end, amounts, unit } of quantities) {
    const push = (dimension: Dimension, size: number, whole = false) =>
      measures.push({
        start,
        end,
        values: amounts.map((amount) => amount * size),
        dimension,
        whole,
        metric: unit.metric ?? false,
        packageSize: false,
      });
    if (unit.metric) {
      push(unit.dimension, unit.size);
    } else if (unit.stick) {
      if (ingredient?.kind !== "dry" || !ingredient.sticks) return null;
      push("weight", unit.size, true);
    } else if (unit.ounce && ingredient?.kind === "liquid") {
      push("volume", FLUID_OUNCE_ML);
    } else if (unit.dimension === "volume" && ingredient?.kind === "dry") {
      push("weight", unit.size * ingredient.gramsPerMl);
    } else {
      push(unit.dimension, unit.size);
    }
  }
  return measures;
}

/** Every quantity in the line, or null when any of them can't be read. */
function findQuantities(line: string): Quantity[] | null {
  const quantities: Quantity[] = [];
  for (const match of line.matchAll(QUANTITY)) {
    const amounts = parseAmounts(match[1]!, match[2]);
    if (!amounts) return null;
    quantities.push({
      start: match.index,
      end: match.index + match[0].length,
      amountEnd: (match.indices![2] ?? match.indices![1]!)[1],
      unitStart: match.indices![3]![0],
      amounts,
      unit: unitOf(match[3]!),
    });
  }
  const isCovered = (start: number, end: number) =>
    quantities.some(
      (q) => q.end >= end && (q.start <= start || COUNT_BEFORE_PACKAGE.test(line.slice(start, q.start))),
    );
  for (const match of line.matchAll(LOOSE_QUANTITY)) {
    if (!isCovered(match.index, match.index + match[0].length)) return null;
  }
  return quantities;
}

/** Merges measures joined by "plus" into one, when they measure the same thing. */
function combineCompounds(line: string, measures: Measure[]): Measure[] {
  const combined: Measure[] = [];
  for (const measure of measures) {
    const previous = combined.at(-1);
    if (
      previous &&
      previous.dimension === measure.dimension &&
      COMPOUND_JOIN.test(line.slice(previous.end, measure.start))
    ) {
      combined[combined.length - 1] = {
        ...previous,
        end: measure.end,
        values: sum(previous.values, measure.values),
        whole: previous.whole && measure.whole,
        metric: previous.metric && measure.metric,
        packageSize: previous.packageSize && measure.packageSize,
      };
    } else {
      combined.push(measure);
    }
  }
  return combined;
}

// Adding a single amount to a range adds it to both ends.
function sum(a: number[], b: number[]): number[] {
  const length = Math.max(a.length, b.length);
  return Array.from({ length }, (_, i) => a[Math.min(i, a.length - 1)]! + b[Math.min(i, b.length - 1)]!);
}
