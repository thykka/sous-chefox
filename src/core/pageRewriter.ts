import type { Replacement } from "./replacements";
import { textNodesOf } from "./visibleText";

const MARKER_CLASS = "sous-chefox-converted";

/** How to put one rewritten text node back: the original node and what replaced it. */
type Swap = { original: Text; replacement: Node[] };

/** Finds what to rewrite in the text of one line. */
export type FindReplacements = (line: string) => Replacement[];

/**
 * Rewrites the pieces `find` picks out in each line of a list (ingredients or
 * instruction steps). Every swapped text node is kept, so `revert` puts back exactly
 * the nodes the page had.
 */
export function rewriteList(list: Element, find: FindReplacements): () => void {
  let swaps = linesOf(list).flatMap((line) => rewriteLineElement(line, find));
  return () => {
    const undone = swaps;
    swaps = [];
    for (const { original, replacement } of undone) {
      replacement[0]!.parentNode!.insertBefore(original, replacement[0]!);
      for (const node of replacement) node.parentNode!.removeChild(node);
    }
  };
}

function linesOf(list: Element): Element[] {
  const items = [...list.querySelectorAll("li")];
  return items.length > 0 ? items : [...list.children];
}

function rewriteLineElement(line: Element, find: FindReplacements): Swap[] {
  const nodes = textNodesOf(line);
  const text = nodes.map((node) => node.data).join("");
  const replacements = find(text);
  if (replacements.length === 0) return [];

  const doc = line.ownerDocument;
  const swaps: Swap[] = [];
  let nodeStart = 0;
  for (const node of nodes) {
    const nodeEnd = nodeStart + node.data.length;
    const overlapping = replacements.filter((r) => r.start < nodeEnd && r.end > nodeStart);
    if (overlapping.length > 0) {
      const replacement: Node[] = [];
      let cursor = nodeStart;
      for (const r of overlapping) {
        const from = Math.max(r.start, nodeStart);
        const to = Math.min(r.end, nodeEnd);
        if (from > cursor) replacement.push(doc.createTextNode(text.slice(cursor, from)));
        // The whole replacement goes where the piece starts; nodes it spans into are emptied.
        const isStart = from === r.start;
        replacement.push(marker(doc, isStart ? r.text : "", isStart ? (r.original ?? text.slice(r.start, r.end)) : null));
        cursor = to;
      }
      if (cursor < nodeEnd) replacement.push(doc.createTextNode(text.slice(cursor, nodeEnd)));
      node.replaceWith(...replacement);
      swaps.push({ original: node, replacement });
    }
    nodeStart = nodeEnd;
  }
  return swaps;
}

function marker(doc: Document, text: string, original: string | null): HTMLElement {
  const el = doc.createElement("span");
  el.className = MARKER_CLASS;
  el.textContent = text;
  if (original !== null) el.title = original;
  return el;
}
