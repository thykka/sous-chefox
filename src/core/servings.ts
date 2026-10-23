// "4", "4 servings", "Yield: 4 servings", "Makes 4 portions", "Serves 4", "Serves 4 people",
// "Servings: 4". A range ("Serves 4-6") or a yield of things ("Makes 12", "1 loaf",
// "16 brownies") isn't a number of servings.
const SERVINGS = [
  /^(\d+)$/,
  /^(?:(?:yields?|makes)\s*:?\s*)?(\d+)\s+(?:servings?|portions?|people|persons)\b/i,
  /^(?:serves|servings?|portions?)\s*:?\s*(\d+)(?:\s+(?:people|persons))?$/i,
];

/** The number of servings a recipe's yields give, or null when none of them reads as one. */
export function parseServings(yields: string[]): number | null {
  for (const text of yields) {
    for (const pattern of SERVINGS) {
      const servings = Number(text.trim().match(pattern)?.[1]);
      if (servings > 0) return servings;
    }
  }
  return null;
}
