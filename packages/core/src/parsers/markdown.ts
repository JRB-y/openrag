import { filenameToTitle, firstHeadingTitle } from "./title.js";
import type { ParseResult } from "./types.js";

export function parseMarkdown(buffer: Buffer, filename: string): ParseResult {
  const markdown = buffer.toString("utf-8");
  return { title: firstHeadingTitle(markdown) ?? filenameToTitle(filename), markdown };
}
