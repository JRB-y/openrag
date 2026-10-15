import mammoth from "mammoth";
import { htmlToMarkdown } from "./markdown-converter.js";
import { filenameToTitle, firstHeadingTitle } from "./title.js";
import type { ParseResult } from "./types.js";

export async function parseDocx(buffer: Buffer, filename: string): Promise<ParseResult> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const markdown = htmlToMarkdown(html);

  return { title: firstHeadingTitle(markdown) ?? filenameToTitle(filename), markdown };
}
