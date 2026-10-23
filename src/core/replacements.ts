import { AMOUNT, AMOUNT_BOUNDARY, AMOUNT_START, RANGE_SEPARATOR, parseAmounts } from "./amount";
import { matchIngredient, type IngredientMatch } from "./densities";
import { formatMetric } from "./format";
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
 * `metric` ones were written in metric to begin with.
 */
type Measure = { start: number; end: number; values: number[]; dimension: Dimension; whole: boolean; metric: boolean };

/**
 * A measure to write into the line over `start`–`end`. A metric amount the site gave
 * alongside imperial carries its own text, which is shown as written.
 */
type Piece = { start: number; end: number; measure: Measure; siteText?: string };

const QUANTITY = new RegExp(
  String.raw`${AMOUNT_BOUNDARY}(${AMOUNT})(?:(?:${RANGE_SEPARATOR})(${AMOUNT}))?\s*(${UNIT})`,
  "gi",
);

// Anything number-like before a unit. Each must be part of a readable quantity, or the
// line has an amount we can't read and stays as written rather than half-converted.
const LOOSE_QUANTITY = new RegExp(
  String.raw`${AMOUNT_START}(?:${AMOUNT_START}|[.,/⁄\s–—-])*?\s*(?:${UNIT})`,
  "gi",
);

// What joins the parts of a compound amount, as in "1 cup plus 2 tbsp".
const COMPOUND_JOIN = /^\s*(?:\+|plus)\s*$/i;

export function findReplacements(line: string, options: LineOptions): Replacement[] {
  // Scaling amounts in their original units comes with the scaling control.
  if (!options.metric) return [];
  const quantities = findQuantities(line);
  if (!quantities) return [];
  const measures = toMetric(quantities, matchIngredient(nameOf(line, quantities)));
  if (!measures) return [];
  const combined = combineCompounds(line, measures);
  if (combined.every((measure) => measure.metric)) return [];
  const pieces = pairWithSiteMetric(line, combined);
  if (!pieces) return [];
  return pieces.map(({ start, end, measure, siteText }) => {
    const text =
      siteText !== undefined && options.scale === 1
        ? siteText
        : formatMetric(
            measure.values.map((value) => value * options.scale),
            measure.dimension,
            { locale: options.locale, whole: measure.whole },
          );
    return siteText === undefined ? { start, end, text } : { start, end, text, original: line.trim() };
  });
}

// How a metric amount sits next to an imperial one: "1 cup (120 g)", "200 g / 7 oz".
const PAIR_OPEN = /^\s*[([]\s*$/;
const PAIR_CLOSE = /^\s*[)\]]/;
const PAIR_SLASH = /^\s*\/\s*$/;

/**
 * Joins each imperial measure with a metric amount written right next to it, either
 * order, so the site's own figure replaces both. Null when the line has a metric
 * amount that isn't paired like that: it already gives metric, so it's left alone.
 */
function pairWithSiteMetric(line: string, measures: Measure[]): Piece[] | null {
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
    if (first.metric) return null;
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
  const isCovered = (start: number, end: number) => quantities.some((q) => q.start <= start && q.end >= end);
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
