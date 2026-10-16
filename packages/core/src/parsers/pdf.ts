import { extractText, extractTextItems, getDocumentProxy, getMeta } from "unpdf";
import { applyHeadingMarkup, detectHeadingLines } from "./pdf-headings.js";
import { filenameToTitle } from "./title.js";
import type { ParsePage, ParseResult } from "./types.js";

export async function parsePdf(buffer: Buffer, filename: string): Promise<ParseResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const [{ text: pageTexts }, { items: pageItems }, meta] = await Promise.all([
    extractText(pdf, { mergePages: false }),
    extractTextItems(pdf),
    getMeta(pdf),
  ]);

  const headingDepthByText = detectHeadingLines(pageItems);

  const pages: ParsePage[] = [];
  let markdown = "";

  pageTexts.forEach((pageText, index) => {
    pages.push({ page: index + 1, startOffset: markdown.length });
    markdown += (index > 0 ? "\n\n" : "") + applyHeadingMarkup(pageText.trim(), headingDepthByText);
  });

  const metaTitle = typeof meta.info.Title === "string" ? meta.info.Title.trim() : "";

  return {
    title: metaTitle || filenameToTitle(filename),
    markdown,
    pages,
  };
}
