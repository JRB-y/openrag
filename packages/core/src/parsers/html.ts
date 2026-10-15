import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { htmlToMarkdown } from "./markdown-converter.js";
import { filenameToTitle, firstHeadingTitle } from "./title.js";
import type { ParseResult } from "./types.js";

export function parseHtml(buffer: Buffer, filename: string): ParseResult {
  const html = buffer.toString("utf-8");
  const dom = new JSDOM(html);
  const article = new Readability(dom.window.document).parse();

  // Readability returns null when it can't find enough article-like
  // content (e.g. a short snippet) - fall back to the raw body.
  const contentHtml = article?.content ?? dom.window.document.body.innerHTML;
  const markdown = htmlToMarkdown(contentHtml);
  const title = article?.title?.trim() || firstHeadingTitle(markdown) || filenameToTitle(filename);

  return { title, markdown };
}
