import type { ParsePage } from "../parsers/types.js";

// pages is sorted ascending by startOffset (built that way by pdf.ts),
// so the right page is the last one whose startOffset is <= offset.
export function findPageForOffset(pages: ParsePage[] | undefined, offset: number | undefined): number | null {
  if (!pages || pages.length === 0 || offset === undefined) {
    return null;
  }

  let page: number | null = null;
  for (const p of pages) {
    if (p.startOffset > offset) break;
    page = p.page;
  }

  return page;
}
