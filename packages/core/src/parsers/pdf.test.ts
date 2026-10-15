import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePdf } from "./pdf.js";

const fixturesDir = path.join(import.meta.dirname, "fixtures");

// Minimal single-page PDF with no /Info dictionary, to exercise the
// filename fallback when there is no metadata title.
const PDF_WITHOUT_TITLE = Buffer.from(
  "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n" +
    "4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
    "5 0 obj<</Length 30>>\nstream\nBT /F1 12 Tf 20 100 Td (Hi) Tj ET\nendstream\nendobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF",
  "latin1",
);

describe("parsePdf", () => {
  it("extracts the title from the PDF metadata", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.pdf"));
    const result = await parsePdf(buffer, "sample.pdf");

    expect(result.title).toBe("Politique RH");
  });

  it("tracks each page's start offset in the merged markdown", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.pdf"));
    const result = await parsePdf(buffer, "sample.pdf");

    expect(result.pages).toEqual([
      { page: 1, startOffset: 0 },
      { page: 2, startOffset: expect.any(Number) },
    ]);
    expect(result.markdown).toContain("Guide RH");
    expect(result.markdown.slice(result.pages![1]!.startOffset)).toContain("Fin du document");
  });

  it("falls back to the filename when there is no metadata title", async () => {
    const result = await parsePdf(PDF_WITHOUT_TITLE, "renamed.pdf");
    expect(result.title).toBe("renamed");
  });
});
