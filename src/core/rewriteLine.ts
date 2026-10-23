import { findReplacements, type LineOptions } from "./replacements";

/** Rewrites one ingredient line, or returns null when it stays unchanged. */
export function rewriteLine(line: string, options: LineOptions): string | null {
  const replacements = findReplacements(line, options);
  if (replacements.length === 0) return null;
  let result = "";
  let cursor = 0;
  for (const { start, end, text } of replacements) {
    result += line.slice(cursor, start) + text;
    cursor = end;
  }
  return result + line.slice(cursor);
}
