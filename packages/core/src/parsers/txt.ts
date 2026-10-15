import { filenameToTitle } from "./title.js";
import type { ParseResult } from "./types.js";

export function parseTxt(buffer: Buffer, filename: string): ParseResult {
  return { title: filenameToTitle(filename), markdown: buffer.toString("utf-8") };
}
