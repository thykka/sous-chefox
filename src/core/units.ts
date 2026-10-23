export type Dimension = "volume" | "weight";

/** A US customary unit, how it's written, and its size in ml (volume) or g (weight). */
type Unit = { dimension: Dimension; size: number; pattern: string };

// US customary sizes are assumed throughout. "oz" alone means weight.
const UNITS: Unit[] = [
  { dimension: "volume", size: 29.5735, pattern: String.raw`fl(?:uid)?\.?\s*(?:oz|ounces?)\.?` },
  { dimension: "volume", size: 4.92892, pattern: String.raw`teaspoons?|tsps?\.?` },
  { dimension: "volume", size: 14.7868, pattern: String.raw`tablespoons?|tbsps?\.?|tbs\.?` },
  { dimension: "volume", size: 236.588, pattern: String.raw`cups?` },
  { dimension: "volume", size: 473.176, pattern: String.raw`pints?|pts?\.?` },
  { dimension: "volume", size: 946.353, pattern: String.raw`quarts?|qts?\.?` },
  { dimension: "volume", size: 3785.41, pattern: String.raw`gallons?|gal\.?` },
  { dimension: "weight", size: 28.3495, pattern: String.raw`ounces?|oz\.?` },
  { dimension: "weight", size: 453.592, pattern: String.raw`pounds?|lbs?\.?` },
];

const ANCHORED = UNITS.map((unit) => ({ unit, regex: new RegExp(`^(?:${unit.pattern})$`, "i") }));

/** Any unit in the table. Fluid ounces come first so "fl oz" never reads as "oz". */
export const UNIT = `(?:${UNITS.map((unit) => unit.pattern).join("|")})(?!\\w)`;

/** The unit for text matched by `UNIT`. */
export function unitOf(text: string): Pick<Unit, "dimension" | "size"> {
  return ANCHORED.find(({ regex }) => regex.test(text))!.unit;
}
