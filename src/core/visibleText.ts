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

export function visibleText(root: Node): string {
  return textNodesOf(root)
    .map((node) => node.data)
    .join("");
}
