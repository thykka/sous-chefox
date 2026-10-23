import { AMOUNT, AMOUNT_BOUNDARY, AMOUNT_START, RANGE_SEPARATOR, parseAmounts } from "./amount";
import { matchIngredient, type IngredientMatch } from "./densities";
import { formatCount, formatMetric } from "./format";
import { FLUID_OUNCE_ML, UNIT, unitOf, type Dimension, type Unit } from "./units";

export type LineOptions = { scale: number; metric: boolean; locale?: string };

/**
 * A piece of a line to swap out: `text` replaces `line.slice(start, end)`. `original`
 * is what the tooltip shows, when it's more than the piece itself.
 */
export type Replacement = { start: number; end: number; text: string; original?: string };

/** An amount (or range) as written: one value, or both ends of a range. */
type Quantity = { start: number; end: number; amounts: number[]; unit: Unit };

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
 * alongside imperial carries its own text, which is shown as written.
 */
type Piece = { start: number; end: number; measure: Measure; siteText?: string };

// The unit may be hyphenated on, as in "a 15-ounce can".
const QUANTITY = new RegExp(
  String.raw`${AMOUNT_BOUNDARY}(${AMOUNT})(?:(?:${RANGE_SEPARATOR})(${AMOUNT}))?\s*-?\s*(${UNIT})`,
  "gi",
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

// What sits between a count and its package size: "2 (14 oz) cans", "1 15-oz can".
const PACKAGE_JOIN = /^\s*\(?\s*$/;

export function findReplacements(line: string, options: LineOptions): Replacement[] {
  // Scaling amounts in their original units comes with the settings popup.
  if (!options.metric) return [];
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

  const measured = pieces.map(({ start, end, measure, siteText }): Replacement => {
    const scale = measure.packageSize ? 1 : options.scale;
    const text =
      siteText !== undefined && scale === 1
        ? siteText
        : formatMetric(
            measure.values.map((value) => value * scale),
            measure.dimension,
            { locale: options.locale, whole: measure.whole },
          );
    return siteText === undefined ? { start, end, text } : { start, end, text, original: line.trim() };
  });
  const counted = counts.map(({ start, end, values }) => ({
    start,
    end,
    text: formatCount(
      values.map((value) => value * options.scale),
      options.locale,
    ),
  }));
  return [...measured, ...counted].sort((a, b) => a.start - b.start);
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
  for (const count of counts) {
    const next = measures.find((measure) => measure.start >= count.end);
    if (next && PACKAGE_JOIN.test(line.slice(count.end, next.start))) next.packageSize = true;
  }
}

// How a metric amount sits next to an imperial one: "1 cup (120 g)", "200 g / 7 oz".
const PAIR_OPEN = /^\s*[([]\s*$/;
const PAIR_CLOSE = /^\s*[)\]]/;
const PAIR_SLASH = /^\s*\/\s*$/;

/**
 * Joins each imperial measure with a metric amount written right next to it, either
 * order, so the site's own figure replaces both. Null when the line has a metric
 * amount that isn't paired like that, unless `keepUnpaired` keeps it as a piece too.
 */
function pairWithSiteMetric(line: string, measures: Measure[], keepUnpaired: boolean): Piece[] | null {
  const pieces: Piece[] = [];
  for (let i = 0; i < measures.length; i++) {
    const first = measures[i]!;
    const second = measures[i + 1];
    if (second && first.metric !== second.metric) {
      const between = line.slice(first.end, second.start);
      const close = line.slice(second.end).match(PAIR_CLOSE);
      const end = PAIR_SLASH.test(between) ? second.end : PAIR_OPEN.test(between) && close ? second.end + close[0].length : null;
      if (end !== null) {
        const metric = first.metric ? first : second;
        pieces.push({ start: first.start, end, measure: metric, siteText: line.slice(metric.start, metric.end) });
        i++;
        continue;
      }
    }
    if (first.metric && !keepUnpaired) return null;
    pieces.push({ start: first.start, end: first.end, measure: first });
  }
  return pieces;
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
    const measure = (dimension: Dimension, size: number, whole = false) =>
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
      measure(unit.dimension, unit.size);
    } else if (unit.stick) {
      if (ingredient?.kind !== "dry" || !ingredient.sticks) return null;
      measure("weight", unit.size, true);
    } else if (unit.ounce && ingredient?.kind === "liquid") {
      measure("volume", FLUID_OUNCE_ML);
    } else if (unit.dimension === "volume" && ingredient?.kind === "dry") {
      measure("weight", unit.size * ingredient.gramsPerMl);
    } else {
      measure(unit.dimension, unit.size);
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
    quantities.push({ start: match.index, end: match.index + match[0].length, amounts, unit: unitOf(match[3]!) });
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
