const HIDDEN_CONTAINERS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

/** Text nodes under `root` in document order, skipping script and style contents. */
export function textNodesOf(root: Node): Text[] {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      HIDDEN_CONTAINERS.has(node.parentElement?.tagName ?? "")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

/** The text nodes under `root` in runs that line breaks (`<br>`) separate. */
export function textLinesOf(root: Element): Text[][] {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      HIDDEN_CONTAINERS.has((node instanceof Element ? node : node.parentElement)?.tagName ?? "")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const lines: Text[][] = [[]];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Element) {
      if (node.tagName === "BR") lines.push([]);
    } else {
      lines.at(-1)!.push(node as Text);
    }
  }
  return lines.filter((line) => line.length > 0);
}
