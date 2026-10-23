import type { Dimension } from "./units";

const UNIT_NAMES: Record<Dimension, { small: string; large: string }> = {
  volume: { small: "ml", large: "l" },
  weight: { small: "g", large: "kg" },
};

/**
 * How to write amounts. `kitchen` writes volumes in Finnish kitchen units (dl, rkl, tl)
 * instead of ml; `decimals` writes their numbers and counts as "0,5" instead of "½".
 */
export type NumberStyle = { locale?: string | undefined; kitchen?: boolean | undefined; decimals?: boolean | undefined };

export type FormatOptions = NumberStyle & { whole?: boolean };

/**
 * A metric amount, or a range of two, rounded to what a cook would measure:
 * "240 ml", "1.5 l", "470–710 ml", "950 ml–1.4 l", or with `kitchen` volumes
 * "2,5 dl", "1 rkl". `whole` amounts are exact figures ("113 g" for a stick of
 * butter), only rounded to whole units.
 */
export function formatMetric(values: number[], dimension: Dimension, options: FormatOptions = {}): string {
  if (dimension === "volume" && options.kitchen) return formatKitchenVolume(values, options);
  const number = new Intl.NumberFormat(options.locale ?? globalThis.navigator?.language, { maximumFractionDigits: 1 });
  const parts = values.map((value) => {
    const { amount, unit } = metricAmount(options.whole ? Math.round(value) : value, dimension, !options.whole);
    return { number: number.format(amount), unit };
  });
  return joinRange(parts);
}

function joinRange([low, high]: { number: string; unit: string }[]): string {
  if (!high || (low!.number === high.number && low!.unit === high.unit)) return `${low!.number} ${low!.unit}`;
  if (low!.unit === high.unit) return `${low!.number}–${high.number} ${high.unit}`;
  return `${low!.number} ${low!.unit}–${high.number} ${high.unit}`;
}

/**
 * Finnish kitchen units, each in the steps a cook measures: teaspoons ("tl") in
 * quarters, tablespoons ("rkl") in halves, decilitres in quarters under 1 dl and halves
 * above, then litres to one decimal. A tablespoon (14.8 ml) stays "1 rkl".
 */
const KITCHEN_UNITS: { below: number; unit: string; size: number; step: number }[] = [
  { below: 13, unit: "tl", size: 5, step: 0.25 },
  { below: 45, unit: "rkl", size: 15, step: 0.5 },
  { below: 100, unit: "dl", size: 100, step: 0.25 },
  { below: 1000, unit: "dl", size: 100, step: 0.5 },
  { below: Infinity, unit: "l", size: 1000, step: 0.1 },
];

function formatKitchenVolume(ml: number[], style: NumberStyle): string {
  const number = new Intl.NumberFormat(style.locale ?? globalThis.navigator?.language, { maximumFractionDigits: 2 });
  const parts = ml.map((value) => {
    const { unit, size, step } = KITCHEN_UNITS.find((u) => value < u.below)!;
    // Never rounded away to nothing: the smallest is one step.
    const amount = Math.max(step, roundTo(value / size, step));
    // Already rounded to its step; tenths of a litre have no common fraction.
    return { number: style.decimals || unit === "l" ? number.format(amount) : formatCount([amount], style), unit };
  });
  return joinRange(parts);
}

function metricAmount(value: number, dimension: Dimension, round: boolean): { amount: number; unit: string } {
  const rounded = round ? roundMetric(value, dimension) : value;
  const names = UNIT_NAMES[dimension];
  if (rounded >= 1000) return { amount: roundTo(rounded / 1000, 0.1), unit: names.large };
  return { amount: rounded, unit: names.small };
}

// Below 2.5 the first step would round to zero, so tiny amounts keep a decimal instead.
function roundMetric(value: number, dimension: Dimension): number {
  if (value < 2.5) return roundTo(value, 0.1);
  if (value < 15 && dimension === "volume") return roundTo(value, 2.5);
  if (value < 100) return roundTo(value, 5);
  if (value < 1000) return roundTo(value, 10);
  return value;
}

function decimalStep(value: number): number {
  if (value < 0.25) return 0.05;
  if (value < 10) return 0.25;
  if (value < 100) return 0.5;
  return 1;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** °C rounded to the nearest 5, or a range of two: "175 °C", "175–190 °C". */
export function formatTemperature(celsius: number[], locale?: string): string {
  const number = new Intl.NumberFormat(locale ?? globalThis.navigator?.language);
  return `${celsius.map((value) => number.format(roundTo(value, 5))).join("–")} °C`;
}

/**
 * Lengths in cm, joined by `separator` (pan sides with "×", range ends with "–"):
 * "23×33 cm", "2.5 cm". When the largest is under 2 cm they're in mm instead ("6 mm").
 * Centimetres are rounded to the nearest 0.5 under 10 cm, and to whole ones above.
 */
export function formatLength(cm: number[], separator: string, locale?: string): string {
  const number = new Intl.NumberFormat(locale ?? globalThis.navigator?.language, { maximumFractionDigits: 1 });
  if (Math.max(...cm) < 2) {
    return `${cm.map((value) => number.format(Math.max(1, Math.round(value * 10)))).join(separator)} mm`;
  }
  return `${cm.map((value) => number.format(roundTo(value, value < 10 ? 0.5 : 1))).join(separator)} cm`;
}

/** The fractions a cook reads at a glance, for counts that scaling made fractional. */
const FRACTIONS: [number, string][] = [
  [0, ""],
  [1 / 8, "⅛"],
  [1 / 6, "⅙"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [1, ""],
];

/**
 * A count, or a range of two, to the nearest common fraction: "1½", "¾", "3–4½".
 * A count is never rounded away to nothing; the smallest is "⅛". With `decimals` it's
 * a decimal instead, in quarters under 10 ("1,5", "0,25"), halves under 100 and whole
 * numbers above; the smallest is "0,05".
 */
export function formatCount(values: number[], style: NumberStyle = {}): string {
  const number = new Intl.NumberFormat(style.locale ?? globalThis.navigator?.language, { maximumFractionDigits: 2 });
  if (style.decimals) {
    const parts = values.map((value) => number.format(Math.max(0.05, roundTo(value, decimalStep(value)))));
    return parts[1] === undefined || parts[1] === parts[0] ? parts[0]! : `${parts[0]}–${parts[1]}`;
  }
  const parts = values.map((value) => {
    let whole = Math.floor(value);
    const [fraction, glyph] = FRACTIONS.reduce((best, candidate) =>
      Math.abs(candidate[0] - (value - whole)) < Math.abs(best[0] - (value - whole)) ? candidate : best,
    );
    if (fraction === 1) whole++;
    if (whole === 0 && glyph === "") return "⅛";
    return `${whole > 0 ? number.format(whole) : ""}${glyph}`;
  });
  const [low, high] = parts;
  return high === undefined || high === low ? low! : `${low}–${high}`;
}
