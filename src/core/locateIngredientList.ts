import { textNodesOf } from "./visibleText";

/** Share of the structured ingredients the element must contain. */
const MIN_RECALL = 0.8;
/** Share of the element's words that must belong to those ingredients. */
const MIN_PRECISION = 0.5;
/** Share of an ingredient's words that must appear for it to count as present. */
const MIN_INGREDIENT_OVERLAP = 0.7;

/**
 * Finds the element whose text best matches the structured ingredient strings,
 * or null when no element matches confidently.
 */
export function locateIngredientList(doc: Document, ingredients: string[]): Element | null {
  const wanted = ingredients.map(tokenize).filter((tokens) => tokens.length > 0);
  if (wanted.length === 0) return null;

  let best: Element | null = null;
  let bestScore = 0;
  for (const candidate of candidatesOf(doc)) {
    // Each text node on its own: list items often run together with no space between.
    const tokens = textNodesOf(candidate).flatMap((node) => tokenize(node.data));
    if (tokens.length === 0) continue;
    const present = new Set(tokens);
    const matched = wanted.filter(
      (ingredient) =>
        ingredient.filter((token) => present.has(token)).length / ingredient.length >=
        MIN_INGREDIENT_OVERLAP,
    );
    const recall = matched.length / wanted.length;
    const matchedTokens = matched.reduce((sum, ingredient) => sum + ingredient.length, 0);
    const precision = Math.min(1, matchedTokens / tokens.length);
    if (recall < MIN_RECALL || precision < MIN_PRECISION) continue;
    // Candidates come in document order, so on a tie the deeper element wins.
    const score = recall * precision;
    if (score >= bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Lists and every element that contains one, in document order. */
function candidatesOf(doc: Document): Element[] {
  const candidates = new Set<Element>();
  for (const list of doc.body?.querySelectorAll("ul, ol") ?? []) {
    for (let el: Element | null = list; el && el !== doc.body; el = el.parentElement) {
      candidates.add(el);
    }
  }
  return [...candidates].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}
