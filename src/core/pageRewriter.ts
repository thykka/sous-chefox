import type { Replacement } from "./replacements";
import { textLinesOf } from "./visibleText";

const MARKER_CLASS = "sous-chefox-converted";

/** How to put one rewritten text node back: the original node and what replaced it. */
type Swap = { original: Text; replacement: Node[] };

/** Finds what to rewrite in the text of one line. */
export type FindReplacements = (line: string) => Replacement[];

/**
 * Rewrites the pieces `find` picks out in each line (an ingredient or an instruction
 * step). Every swapped text node is kept, so `revert` puts back exactly the nodes the
 * page had.
 */
export function rewriteLines(lines: Element[], find: FindReplacements): () => void {
  let swaps = lines.flatMap(textLinesOf).flatMap((nodes) => rewriteLine(nodes, find));
  return () => {
    const undone = swaps;
    swaps = [];
    for (const { original, replacement } of undone) {
      // A site that re-rendered the line has already thrown the rewrite away.
      if (!replacement[0]!.parentNode) continue;
      replacement[0]!.parentNode.insertBefore(original, replacement[0]!);
      for (const node of replacement) node.parentNode!.removeChild(node);
    }
  };
}

/** The lines of a list: its items, a table's rows of cells, or its children. */
export function linesOf(list: Element): Element[] {
  const items = [...list.querySelectorAll("li")];
  if (items.length > 0) return items;
  const rows = [...list.querySelectorAll("tr")].filter((row) => row.querySelector("td"));
  return rows.length > 0 ? rows : [...list.children];
}

// Elements that start a new box on the page: text on either side of one reads apart.
const BLOCKS = new Set(["ADDRESS", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "P", "SECTION", "TD", "TH", "TR"]);

/**
 * The text of a line, from the text nodes that make it up. Nodes in different blocks or
 * table cells read as separate words, as "1 dl" and "oliiviöljyä" do in two cells, so a
 * space goes between them when neither has one. `starts` is where each node begins.
 */
export function lineText(nodes: Text[]): string {
  return lineLayout(nodes).text;
}

function lineLayout(nodes: Text[]): { text: string; starts: number[] } {
  let text = "";
  const starts: number[] = [];
  nodes.forEach((node, i) => {
    const previous = nodes[i - 1];
    if (previous && blockOf(previous) !== blockOf(node) && /\S$/.test(text) && /^\S/.test(node.data)) text += " ";
    starts.push(text.length);
    text += node.data;
  });
  return { text, starts };
}

function blockOf(node: Text): Element | null {
  let el = node.parentElement;
  while (el && !BLOCKS.has(el.tagName)) el = el.parentElement;
  return el;
}

function rewriteLine(nodes: Text[], find: FindReplacements): Swap[] {
  const { text, starts } = lineLayout(nodes);
  const replacements = find(text);
  if (replacements.length === 0) return [];

  const doc = nodes[0]!.ownerDocument;
  const swaps: Swap[] = [];
  for (const [i, node] of nodes.entries()) {
    const nodeStart = starts[i]!;
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
        const original = r.original === undefined ? text.slice(r.start, r.end) : r.original;
        replacement.push(marker(doc, isStart ? r.text : "", isStart ? original : null));
        cursor = to;
      }
      if (cursor < nodeEnd) replacement.push(doc.createTextNode(text.slice(cursor, nodeEnd)));
      node.replaceWith(...replacement);
      swaps.push({ original: node, replacement });
    }
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
