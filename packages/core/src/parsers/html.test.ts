import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseHtml } from "./html.js";

const fixturesDir = path.join(import.meta.dirname, "fixtures");

describe("parseHtml", () => {
  it("extracts the title from <title>", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.html"));
    const result = parseHtml(buffer, "sample.html");

    expect(result.title).toBe("Guide RH - Congés payés");
  });

  it("keeps the article's headings and table, and drops nav/footer boilerplate", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.html"));
    const result = parseHtml(buffer, "sample.html");

    expect(result.markdown).toContain("## Congés payés");
    expect(result.markdown).toContain("| Congés payés | 5 semaines |");
    expect(result.markdown).not.toContain("Copyright OpenRag");
    expect(result.markdown).not.toContain("Accueil");
  });
});
