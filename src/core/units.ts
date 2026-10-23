export type Dimension = "volume" | "weight";

/**
 * A unit, how it's written, and its size in ml (volume) or g (weight). `metric` units
 * are already what the cook wants; the rest are US customary. `ounce` marks the "oz"
 * that turns into fluid ounces for liquids; `stick` is butter only. Spoons are used in
 * metric recipes too.
 */
export type Unit = {
  dimension: Dimension;
  size: number;
  pattern: string;
  metric?: true;
  spoon?: true;
  ounce?: true;
  stick?: true;
};

/** The size of a fluid ounce, for "oz" of a liquid. */
export const FLUID_OUNCE_ML = 29.5735;

// US customary sizes are assumed throughout. "oz" alone means weight.
const UNITS: Unit[] = [
  { dimension: "volume", size: FLUID_OUNCE_ML, pattern: String.raw`fl(?:uid)?\.?\s*(?:oz|ounces?)\.?` },
  { dimension: "volume", size: 4.92892, pattern: String.raw`teaspoons?|tsps?\.?`, spoon: true },
  { dimension: "volume", size: 14.7868, pattern: String.raw`tablespoons?|tbsps?\.?|tbs\.?`, spoon: true },
  { dimension: "volume", size: 236.588, pattern: String.raw`cups?` },
  { dimension: "volume", size: 473.176, pattern: String.raw`pints?|pts?\.?` },
  { dimension: "volume", size: 946.353, pattern: String.raw`quarts?|qts?\.?` },
  { dimension: "volume", size: 3785.41, pattern: String.raw`gallons?|gal\.?` },
  { dimension: "weight", size: 28.3495, pattern: String.raw`ounces?|oz\.?`, ounce: true },
  { dimension: "weight", size: 453.592, pattern: String.raw`pounds?|lbs?\.?` },
  // A US stick of butter is labelled 113 g.
  { dimension: "weight", size: 113, pattern: String.raw`sticks?`, stick: true },
  { dimension: "volume", size: 1, pattern: String.raw`millilit(?:re|er)s?|ml`, metric: true },
  { dimension: "volume", size: 10, pattern: String.raw`centilit(?:re|er)s?|cl`, metric: true },
  { dimension: "volume", size: 100, pattern: String.raw`decilit(?:re|er)s?|dl`, metric: true },
  { dimension: "volume", size: 1000, pattern: String.raw`lit(?:re|er)s?|l`, metric: true },
  { dimension: "weight", size: 1, pattern: String.raw`grams?|grammes?|g`, metric: true },
  { dimension: "weight", size: 1000, pattern: String.raw`kilograms?|kilos?|kgs?`, metric: true },
];

const ANCHORED = UNITS.map((unit) => ({ unit, regex: new RegExp(`^(?:${unit.pattern})$`, "i") }));

/** Any unit in the table. Fluid ounces come first so "fl oz" never reads as "oz". */
export const UNIT = `(?:${UNITS.map((unit) => unit.pattern).join("|")})(?!\\w)`;

/** The unit for text matched by `UNIT`. */
export function unitOf(text: string): Unit {
  return ANCHORED.find(({ regex }) => regex.test(text))!.unit;
}
