export type LineOptions = { scale: number; metric: boolean };

/** A piece of a line to swap out: `text` replaces `line.slice(start, end)`. */
export type Replacement = { start: number; end: number; text: string };

type Unit = "cup" | "tbsp" | "tsp";

const ML_PER_UNIT: Record<Unit, number> = { cup: 236.588, tbsp: 14.787, tsp: 4.929 };

const UNIT_ALIASES: Record<string, Unit> = {
  cup: "cup",
  cups: "cup",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  tsps: "tsp",
};

// Only whole numbers standing alone. A number that continues a fraction, decimal
// or range ("1 1/2", "1.5", "2-3", "2 to 3") is left for the full parser.
const AMOUNT_CHAR = String.raw`[\d¼½¾⅐-⅞]`;
const NOT_PART_OF_LARGER_AMOUNT = [
  String.raw`(?<![\d.,/⁄])`,
  String.raw`(?<!${AMOUNT_CHAR}\s*[-–—]\s*)`,
  String.raw`(?<!${AMOUNT_CHAR}\s+(?:to|or)\s+)`,
].join("");

const QUANTITY = new RegExp(
  String.raw`${NOT_PART_OF_LARGER_AMOUNT}\b(\d+)\s*(${Object.keys(UNIT_ALIASES).join("|")})\b`,
  "gi",
);

export function findReplacements(line: string, options: LineOptions): Replacement[] {
  // Scaling amounts in their original units comes with the scaling control.
  if (!options.metric) return [];
  const replacements: Replacement[] = [];
  for (const match of line.matchAll(QUANTITY)) {
    const unit = UNIT_ALIASES[match[2]!.toLowerCase()]!;
    const ml = Number(match[1]) * options.scale * ML_PER_UNIT[unit];
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      text: `${roundMl(ml)} ml`,
    });
  }
  return replacements;
}

function roundMl(ml: number): number {
  if (ml < 15) return Math.round(ml / 2.5) * 2.5;
  if (ml < 100) return Math.round(ml / 5) * 5;
  return Math.round(ml / 10) * 10;
}
