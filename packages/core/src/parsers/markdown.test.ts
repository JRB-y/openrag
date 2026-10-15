import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdown.js";

const fixturesDir = path.join(import.meta.dirname, "fixtures");

describe("parseMarkdown", () => {
  it("extracts the title from the first H1", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.md"));
    const result = parseMarkdown(buffer, "sample.md");

    expect(result.title).toBe("Guide RH");
  });

  it("keeps the table and headings intact", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.md"));
    const result = parseMarkdown(buffer, "sample.md");

    expect(result.markdown).toContain("## Congés payés");
    expect(result.markdown).toContain("| Congés payés | 5 semaines |");
  });

  it("falls back to the filename when there is no H1", () => {
    const result = parseMarkdown(Buffer.from("just some text"), "notes.md");

    expect(result.title).toBe("notes");
  });
});
