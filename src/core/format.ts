import type { Dimension } from "./units";

const UNIT_NAMES: Record<Dimension, { small: string; large: string }> = {
  volume: { small: "ml", large: "l" },
  weight: { small: "g", large: "kg" },
};

/**
 * A metric amount, or a range of two, rounded to what a cook would measure:
 * "240 ml", "1.5 l", "470–710 ml", "950 ml–1.4 l".
 */
export function formatMetric(values: number[], dimension: Dimension, locale?: string): string {
  const number = new Intl.NumberFormat(locale ?? globalThis.navigator?.language, { maximumFractionDigits: 1 });
  const parts = values.map((value) => {
    const { amount, unit } = metricAmount(value, dimension);
    return { number: number.format(amount), unit };
  });
  const [low, high] = parts;
  if (!high || (low!.number === high.number && low!.unit === high.unit)) return `${low!.number} ${low!.unit}`;
  if (low!.unit === high.unit) return `${low!.number}–${high.number} ${high.unit}`;
  return `${low!.number} ${low!.unit}–${high.number} ${high.unit}`;
}

function metricAmount(value: number, dimension: Dimension): { amount: number; unit: string } {
  const rounded = roundMetric(value, dimension);
  const names = UNIT_NAMES[dimension];
  if (rounded >= 1000) return { amount: roundTo(rounded / 1000, 0.1), unit: names.large };
  return { amount: rounded, unit: names.small };
}

// Below the smallest step a whole amount would round to zero, so tiny amounts keep a decimal.
function roundMetric(value: number, dimension: Dimension): number {
  const smallestStep = dimension === "volume" ? 2.5 : 1;
  if (value < smallestStep) return roundTo(value, 0.1);
  if (value < 15) return roundTo(value, smallestStep);
  if (value < 100) return roundTo(value, 5);
  if (value < 1000) return roundTo(value, 10);
  return value;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
