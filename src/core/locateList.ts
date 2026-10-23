import { linesOf } from "./pageRewriter";
import { textNodesOf } from "./visibleText";

/** Share of the structured lines the element must contain. */
const MIN_RECALL = 0.8;
/** Share of the element's words that must belong to those lines. */
const MIN_PRECISION = 0.5;
/** Share of a line's words that must appear for it to count as present. */
const MIN_LINE_OVERLAP = 0.7;
/**
 * How many lines the element may split into, per structured line. Headings like
 * "TÄYTE" add a few; a wrapper whose lines each hold several ingredients, or that
 * splits every amount from its name, isn't the list.
 */
const LINE_COUNT_RANGE = [0.5, 1.5];

/**
 * Finds the element whose text best matches the structured recipe lines (its
 * ingredients, or its instruction steps), or null when no element matches confidently.
 */
export function locateList(doc: Document, lines: string[]): Element | null {
  const wanted = lines.map(tokenize).filter((tokens) => tokens.length > 0);
  if (wanted.length === 0) return null;

  let best: Element | null = null;
  let bestScore = 0;
  for (const candidate of candidatesOf(doc)) {
    // Each text node on its own: list items often run together with no space between.
    const tokens = textNodesOf(candidate).flatMap((node) => tokenize(node.data));
    if (tokens.length === 0) continue;
    const present = new Set(tokens);
    const matched = wanted.filter(
      (line) => line.filter((token) => present.has(token)).length / line.length >= MIN_LINE_OVERLAP,
    );
    const recall = matched.length / wanted.length;
    const matchedTokens = matched.reduce((sum, line) => sum + line.length, 0);
    const precision = Math.min(1, matchedTokens / tokens.length);
    if (recall < MIN_RECALL || precision < MIN_PRECISION) continue;
    const lineCount = linesOf(candidate).length / wanted.length;
    if (lineCount < LINE_COUNT_RANGE[0]! || lineCount > LINE_COUNT_RANGE[1]!) continue;
    // Candidates come in document order, so on a tie the deeper element wins.
    const score = recall * precision;
    if (score >= bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Lists, tables and every element that contains one, in document order, leaving out
 * any the browser reports as hidden (a print-only copy of the list). A run of `<p>` or
 * `<div>` elements with nothing else beside them counts as a list, as on sites that
 * write each ingredient as one of those.
 */
function candidatesOf(doc: Document): Element[] {
  const candidates = new Set<Element>();
  const runs = [...(doc.body?.querySelectorAll("p:first-child, div:first-child") ?? [])]
    .map((first) => first.parentElement!)
    .filter((parent) => parent.children.length > 1 && [...parent.children].every((child) => child.tagName === parent.firstElementChild!.tagName));
  for (const list of [...(doc.body?.querySelectorAll("ul, ol, table") ?? []), ...runs]) {
    if (isHidden(list)) continue;
    for (let el: Element | null = list; el && el !== doc.body; el = el.parentElement) {
      candidates.add(el);
    }
  }
  return [...candidates].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

// jsdom has no layout and no checkVisibility, so there every element counts as shown.
function isHidden(el: Element): boolean {
  return typeof el.checkVisibility === "function" && !el.checkVisibility();
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\p{L}+|\p{N}+/gu) ?? [];
}
