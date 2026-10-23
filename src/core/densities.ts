/** What the density table knows about an ingredient name. */
export type IngredientMatch =
  | { kind: "dry"; gramsPerMl: number; sticks: boolean; weighed: boolean }
  | { kind: "liquid" }
  | null;

/**
 * An ingredient with every name it goes by. `dry` entries weigh by volume, and the
 * `weighed` ones are weighed even in Finnish kitchens, where flour and sugar go by dl; `liquid`
 * entries turn "oz" into fluid ounces; `other` entries are look-alikes ("peanut butter",
 * "cream cheese") listed only so they never match a shorter dry or liquid name.
 */
type Entry =
  | { kind: "dry"; names: string[]; gramsPerMl: number; packed?: true; sticks?: true; weighed?: true; source: string }
  | { kind: "liquid"; names: string[] }
  | { kind: "other"; names: string[] };

const CUP_ML = 236.588;
const perCup = (grams: number) => grams / CUP_ML;

const KING_ARTHUR = "King Arthur Baking ingredient weight chart";
const USDA_BROWN_SUGAR = "USDA FoodData Central SR Legacy 168833, Sugars, brown";

// Curated on purpose: a wrong gram figure does more harm than a correct ml figure,
// so only well-sourced entries go here. Figures are grams per US cup unless noted.
const ENTRIES: Entry[] = [
  { kind: "dry", names: ["flour", "all purpose flour", "plain flour", "bread flour", "cake flour"], gramsPerMl: perCup(120), source: KING_ARTHUR },
  { kind: "dry", names: ["whole wheat flour", "wholemeal flour"], gramsPerMl: perCup(113), source: KING_ARTHUR },
  { kind: "dry", names: ["almond flour"], gramsPerMl: perCup(96), source: KING_ARTHUR },
  { kind: "dry", names: ["sugar", "granulated sugar", "white sugar", "cane sugar", "caster sugar"], gramsPerMl: perCup(198), source: KING_ARTHUR },
  { kind: "dry", names: ["brown sugar", "light brown sugar", "dark brown sugar"], gramsPerMl: perCup(145), source: USDA_BROWN_SUGAR },
  { kind: "dry", names: ["brown sugar", "light brown sugar", "dark brown sugar"], gramsPerMl: perCup(220), packed: true, source: USDA_BROWN_SUGAR },
  { kind: "dry", names: ["powdered sugar", "confectioners sugar", "icing sugar"], gramsPerMl: perCup(113), source: KING_ARTHUR },
  // 113 g per half cup (one stick).
  { kind: "dry", names: ["butter"], gramsPerMl: perCup(226), sticks: true, weighed: true, source: KING_ARTHUR },
  { kind: "dry", names: ["oats", "rolled oats", "old fashioned oats", "quick oats", "oatmeal"], gramsPerMl: perCup(89), source: KING_ARTHUR },
  // 99 g per half cup, long grain, dry.
  { kind: "dry", names: ["rice", "white rice", "long grain rice"], gramsPerMl: perCup(198), source: KING_ARTHUR },
  // 42 g per half cup.
  { kind: "dry", names: ["cocoa", "cocoa powder", "unsweetened cocoa"], gramsPerMl: perCup(84), source: KING_ARTHUR },
  // 28 g per quarter cup.
  { kind: "dry", names: ["cornstarch", "corn starch", "cornflour"], gramsPerMl: perCup(112), source: KING_ARTHUR },
  { kind: "dry", names: ["chocolate chips", "chocolate chip"], gramsPerMl: perCup(170), weighed: true, source: KING_ARTHUR },

  {
    kind: "liquid",
    names: ["water", "milk", "buttermilk", "cream", "heavy cream", "half and half", "stock", "broth", "juice", "wine", "beer", "oil", "vinegar", "coffee"],
  },

  {
    kind: "other",
    names: [
      "peanut butter", "almond butter", "apple butter", "cocoa butter",
      "sour cream", "cream cheese", "ice cream", "cream of tartar",
      "condensed milk", "milk chocolate",
      "flour tortillas", "coconut flour", "rice flour", "oat flour", "self rising flour",
      "coconut sugar", "sugar snap peas", "steel cut oats", "rice noodles",
    ],
  },
];

/** Words describing how an ingredient is prepared, ignored when matching names. */
const PREPARATION_WORDS = new Set([
  "sifted", "unsifted", "packed", "firmly", "lightly", "loosely", "chopped", "finely", "coarsely",
  "melted", "softened", "cold", "chilled", "cubed", "diced", "unsalted", "salted", "uncooked", "dry",
]);

/** Words that make a dry figure wrong: cooked rice weighs far less than dry rice. */
const DISQUALIFYING_WORDS = new Set(["cooked"]);

type Candidate = { entry: Entry; start: number; end: number };

/**
 * Looks up an ingredient name. The longest matching name wins ("brown sugar" over
 * "sugar"); a name that matches two different ingredients ("oil or melted butter")
 * isn't confident and gives null.
 */
export function matchIngredient(name: string): IngredientMatch {
  const allWords = words(name);
  if (allWords.some((word) => DISQUALIFYING_WORDS.has(word))) return null;
  const packed = allWords.includes("packed");
  const nameWords = allWords.filter((word) => !PREPARATION_WORDS.has(word));

  const candidates: Candidate[] = [];
  for (const entry of entriesFor(packed)) {
    for (const synonym of entry.names) {
      const synonymWords = synonym.split(" ");
      for (let start = 0; start + synonymWords.length <= nameWords.length; start++) {
        if (synonymWords.every((word, i) => nameWords[start + i] === word)) {
          candidates.push({ entry, start, end: start + synonymWords.length });
        }
      }
    }
  }

  // Longest first; on a tie the later name wins, since English puts the head noun last.
  candidates.sort((a, b) => b.end - b.start - (a.end - a.start) || b.end - a.end);
  const chosen: Candidate[] = [];
  for (const candidate of candidates) {
    if (!chosen.some((c) => c.start < candidate.end && candidate.start < c.end)) chosen.push(candidate);
  }
  const entries = new Set(chosen.map((c) => c.entry));
  if (entries.size !== 1) return null;
  const [entry] = entries;
  if (entry!.kind === "other") return null;
  if (entry!.kind === "liquid") return { kind: "liquid" };
  return { kind: "dry", gramsPerMl: entry!.gramsPerMl, sticks: entry!.sticks ?? false, weighed: entry!.weighed ?? false };
}

/** Packed entries replace their loose twin when the name says "packed". */
function entriesFor(packed: boolean): Entry[] {
  const packedNames = new Set(ENTRIES.flatMap((e) => (e.kind === "dry" && e.packed ? e.names : [])));
  return ENTRIES.filter((entry) => {
    if (entry.kind !== "dry") return true;
    if (entry.packed) return packed;
    return !(packed && entry.names.some((n) => packedNames.has(n)));
  });
}

function words(text: string): string[] {
  return text.toLowerCase().match(/\p{L}+/gu) ?? [];
}
