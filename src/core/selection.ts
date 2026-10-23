// Elements that hold one line of text, or several split by line breaks.
const BLOCKS = "p, li, dt, dd, td, th, h1, h2, h3, h4, h5, h6, div, pre, blockquote";

/**
 * The lines a selection touches: the innermost blocks it overlaps, or the block it
 * lies inside. A line that's only partly selected counts as a whole.
 */
export function selectedLines(range: Range): Element[] {
  const container = range.commonAncestorContainer;
  const root = container instanceof Element ? container : container.parentElement;
  if (!root) return [];
  const touched = [...root.querySelectorAll(BLOCKS)].filter((el) => range.intersectsNode(el));
  const innermost = touched.filter((el) => !touched.some((other) => other !== el && el.contains(other)));
  if (innermost.length > 0) return innermost;
  const enclosing = root.closest(BLOCKS);
  return enclosing ? [enclosing] : [];
}
