import { AMOUNT, AMOUNT_START, parseAmount } from "./amount";
import { formatMetric } from "./format";
import { UNIT, unitOf, type Dimension } from "./units";

export type LineOptions = { scale: number; metric: boolean; locale?: string };

/** A piece of a line to swap out: `text` replaces `line.slice(start, end)`. */
export type Replacement = { start: number; end: number; text: string };

/** An amount (or range) with its unit, in metric: one value, or both ends of a range. */
type Quantity = { start: number; end: number; values: number[]; dimension: Dimension };

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
  return combineCompounds(line, quantities).map(({ start, end, values, dimension }) => ({
    start,
    end,
    text: formatMetric(
      values.map((value) => value * options.scale),
      dimension,
      options.locale,
    ),
  }));
}

/** Every quantity in the line, or null when any of them can't be read. */
function findQuantities(line: string): Quantity[] | null {
  const quantities: Quantity[] = [];
  for (const match of line.matchAll(QUANTITY)) {
    const amounts = parseAmounts(match[1]!, match[2]);
    if (!amounts) return null;
    const unit = unitOf(match[3]!);
    quantities.push({
      start: match.index,
      end: match.index + match[0].length,
      values: amounts.map((amount) => amount * unit.size),
      dimension: unit.dimension,
    });
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

/** Merges quantities joined by "plus" into one, when they measure the same thing. */
function combineCompounds(line: string, quantities: Quantity[]): Quantity[] {
  const combined: Quantity[] = [];
  for (const quantity of quantities) {
    const previous = combined.at(-1);
    if (
      previous &&
      previous.dimension === quantity.dimension &&
      COMPOUND_JOIN.test(line.slice(previous.end, quantity.start))
    ) {
      combined[combined.length - 1] = { ...previous, end: quantity.end, values: sum(previous.values, quantity.values) };
    } else {
      combined.push(quantity);
    }
  }
  return combined;
}

// Adding a single amount to a range adds it to both ends.
function sum(a: number[], b: number[]): number[] {
  const length = Math.max(a.length, b.length);
  return Array.from({ length }, (_, i) => a[Math.min(i, a.length - 1)]! + b[Math.min(i, b.length - 1)]!);
}
