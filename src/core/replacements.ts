import { AMOUNT, AMOUNT_START, parseAmount } from "./amount";
import { matchIngredient, type IngredientMatch } from "./densities";
import { formatMetric } from "./format";
import { FLUID_OUNCE_ML, UNIT, unitOf, type Dimension, type Unit } from "./units";

export type LineOptions = { scale: number; metric: boolean; locale?: string };

/** A piece of a line to swap out: `text` replaces `line.slice(start, end)`. */
export type Replacement = { start: number; end: number; text: string };

/** An amount (or range) as written: one value, or both ends of a range. */
type Quantity = { start: number; end: number; amounts: number[]; unit: Unit };

/** A quantity in metric. `whole` amounts are exact, so they're shown in whole units. */
type Measure = { start: number; end: number; values: number[]; dimension: Dimension; whole: boolean };

const RANGE_SEPARATOR = String.raw`\s*[-–—]\s*|\s+(?:to|or)\s+`;

// An amount starts where no other number, word or fraction runs into it.
const QUANTITY = new RegExp(
  String.raw`(?<![\w.,/⁄])(${AMOUNT})(?:(?:${RANGE_SEPARATOR})(${AMOUNT}))?\s*(${UNIT})`,
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
  return combineCompounds(line, measures).map(({ start, end, values, dimension, whole }) => ({
    start,
    end,
    text: formatMetric(
      values.map((value) => value * options.scale),
      dimension,
      { locale: options.locale, whole },
    ),
  }));
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
      measures.push({ start, end, values: amounts.map((amount) => amount * size), dimension, whole });
    if (unit.stick) {
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

/** One amount, or both ends of a range, or null when any of it can't be read. */
function parseAmounts(low: string, high: string | undefined): number[] | null {
  const from = parseAmount(low);
  if (from === null) return null;
  if (high === undefined) return [from];
  const to = parseAmount(high);
  return to === null || to <= from ? null : [from, to];
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
