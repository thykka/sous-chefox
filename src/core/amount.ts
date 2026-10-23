const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 1 / 4,
  "½": 1 / 2,
  "¾": 3 / 4,
  "⅐": 1 / 7,
  "⅑": 1 / 9,
  "⅒": 1 / 10,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};

const UNICODE_FRACTION = `[${Object.keys(UNICODE_FRACTIONS).join("")}]`;

/** A character that can start an amount: a digit or a Unicode fraction. */
export const AMOUNT_START = `[\\d${Object.keys(UNICODE_FRACTIONS).join("")}]`;
const ASCII_FRACTION = String.raw`\d+\s*[/⁄]\s*\d+`;
const DECIMAL = String.raw`(?:\d+(?:\.\d+)?|\.\d+)`;

/** One number as written in a recipe: whole, decimal, fraction or mixed number. */
export const AMOUNT = [
  String.raw`\d+(?:\s+|\s*-\s*)${ASCII_FRACTION}`,
  String.raw`\d+\s*${UNICODE_FRACTION}`,
  ASCII_FRACTION,
  UNICODE_FRACTION,
  DECIMAL,
]
  .map((pattern) => `(?:${pattern})`)
  .join("|");

/**
 * Where an amount can start: no other number, word or fraction runs into it
 * ("7 oz" in "200g/7oz" starts an amount; "2 cups" in "1/2 cups" doesn't).
 */
export const AMOUNT_BOUNDARY = String.raw`(?<![\w.,⁄])(?<!\d\s*[/⁄]\s*)`;

/** What joins the two ends of a range: "2-3", "2 – 3", "2 to 3", "1 or 2". */
export const RANGE_SEPARATOR = String.raw`\s*[-–—]\s*|\s+(?:to|or)\s+`;

const MIXED = new RegExp(String.raw`^(\d+)(?:\s+|\s*-\s*)(\d+)\s*[/⁄]\s*(\d+)$`);
const MIXED_UNICODE = new RegExp(String.raw`^(\d+)\s*(${UNICODE_FRACTION})$`);
const FRACTION = new RegExp(String.raw`^(\d+)\s*[/⁄]\s*(\d+)$`);

/** The value of text matched by `AMOUNT`, or null when it isn't a usable number. */
export function parseAmount(text: string): number | null {
  const mixedMatch = text.match(MIXED);
  if (mixedMatch) return mixed(mixedMatch[1]!, fraction(mixedMatch[2]!, mixedMatch[3]!));
  const mixedUnicodeMatch = text.match(MIXED_UNICODE);
  if (mixedUnicodeMatch) return mixed(mixedUnicodeMatch[1]!, UNICODE_FRACTIONS[mixedUnicodeMatch[2]!]!);
  const fractionMatch = text.match(FRACTION);
  if (fractionMatch) return fraction(fractionMatch[1]!, fractionMatch[2]!);
  if (text in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[text]!;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** One amount, or both ends of a range, or null when any of it can't be read. */
export function parseAmounts(low: string, high: string | undefined): number[] | null {
  const from = parseAmount(low);
  if (from === null) return null;
  if (high === undefined) return [from];
  const to = parseAmount(high);
  return to === null || to <= from ? null : [from, to];
}

function fraction(numerator: string, denominator: string): number | null {
  return Number(denominator) === 0 ? null : Number(numerator) / Number(denominator);
}

// A mixed number's fraction must be a proper one: "1 3/2" is more likely a typo.
function mixed(whole: string, part: number | null): number | null {
  return part === null || part >= 1 ? null : Number(whole) + part;
}
