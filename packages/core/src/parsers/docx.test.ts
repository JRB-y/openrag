import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocx } from "./docx.js";

const fixturesDir = path.join(import.meta.dirname, "fixtures");

describe("parseDocx", () => {
  it("extracts the title from the first heading", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.docx"));
    const result = await parseDocx(buffer, "sample.docx");

    expect(result.title).toBe("Guide RH");
  });

  it("converts the table to a Markdown (GFM) table", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.docx"));
    const result = await parseDocx(buffer, "sample.docx");

    expect(result.markdown).toContain("| Type | Duree |");
    expect(result.markdown).toContain("| Conges payes | 5 semaines |");
  });
});
