import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePdf } from "../parsers/pdf.js";
import { chunkMarkdown } from "./chunk-markdown.js";

const fixturesDir = path.join(import.meta.dirname, "../parsers/fixtures");

describe("chunkMarkdown", () => {
  it("respects the target chunk size when no atomic block forces an exception", () => {
    const paragraphs = Array.from(
      { length: 20 },
      (_, i) => `Ceci est le paragraphe numéro ${i} avec un peu de texte pour occuper de la place.`,
    );
    const markdown = `# Document\n\n${paragraphs.join("\n\n")}\n`;

    const chunks = chunkMarkdown(markdown, { chunkSizeTokens: 50, chunkOverlapTokens: 10 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(50);
    }
  });

  it("does not duplicate an oversized paragraph into the next chunk as overlap", () => {
    // A single paragraph far bigger than the target size, followed by a
    // normal one. The oversized paragraph can't be split (we only split
    // between nodes), but it must not also get carried whole into the
    // next chunk as "overlap" - that would just duplicate it.
    const giant = "Mot ".repeat(2000).trim() + ".";
    const markdown = `# Document\n\n${giant}\n\nUn petit paragraphe normal.\n`;

    const chunks = chunkMarkdown(markdown, { chunkSizeTokens: 500, chunkOverlapTokens: 50 });

    const giantChunks = chunks.filter((c) => c.content.includes("Mot Mot Mot"));
    expect(giantChunks).toHaveLength(1);
    expect(chunks.at(-1)!.content).not.toContain("Mot Mot Mot");
    expect(chunks.at(-1)!.content).toContain("Un petit paragraphe normal.");
  });

  it("never splits a table, even when it exceeds the target size", () => {
    const rows = Array.from({ length: 30 }, (_, i) => `| Ligne ${i} | Valeur ${i} |`);
    const table = ["| Col A | Col B |", "| --- | --- |", ...rows].join("\n");
    const markdown = `# Document\n\nIntro courte.\n\n${table}\n\nConclusion courte.\n`;

    const chunks = chunkMarkdown(markdown, { chunkSizeTokens: 20, chunkOverlapTokens: 5 });

    const tableChunks = chunks.filter((c) => c.content.includes("Col A"));
    expect(tableChunks).toHaveLength(1);
    expect(tableChunks[0]!.content).toContain("Ligne 29");
    expect(tableChunks[0]!.content).toContain("Valeur 29");
    // The table alone is allowed to exceed the target - that's the point.
    expect(tableChunks[0]!.tokenCount).toBeGreaterThan(20);
  });

  it("never splits a code block, even when it exceeds the target size", () => {
    const code = Array.from({ length: 20 }, (_, i) => `const x${i} = ${i};`).join("\n");
    const markdown = `# Document\n\nIntro.\n\n\`\`\`js\n${code}\n\`\`\`\n\nFin.\n`;

    const chunks = chunkMarkdown(markdown, { chunkSizeTokens: 10, chunkOverlapTokens: 2 });

    const codeChunks = chunks.filter((c) => c.content.includes("const x19 = 19;"));
    expect(codeChunks).toHaveLength(1);
    expect(codeChunks[0]!.content).toContain("const x0 = 0;");
  });

  it("builds a correct heading breadcrumb (fil d'Ariane)", () => {
    const markdown = [
      "# Guide RH",
      "",
      "## Congés",
      "",
      "### Congés payés",
      "",
      "Les congés payés sont de 5 semaines par an et doivent être posés à l'avance.",
      "",
    ].join("\n");

    const chunks = chunkMarkdown(markdown, { chunkSizeTokens: 500, chunkOverlapTokens: 50 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.headingPath).toBe("Guide RH > Congés > Congés payés");
  });

  it("merges a section shorter than the minimum into the next one", () => {
    const markdown = [
      "# Guide RH",
      "",
      "Intro.",
      "",
      "## Congés payés",
      "",
      "Les congés payés sont de 5 semaines par an et doivent être posés à l'avance.",
      "",
    ].join("\n");

    const chunks = chunkMarkdown(markdown, { chunkSizeTokens: 500, chunkOverlapTokens: 50 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.headingPath).toBe("Guide RH > Congés payés");
    expect(chunks[0]!.content).toContain("Intro.");
  });

  it("keeps chunks in document order", () => {
    const markdown = [
      "# Document",
      "",
      "Premier paragraphe du document.",
      "",
      "## Section suivante",
      "",
      "Deuxième paragraphe du document, dans une autre section.",
      "",
    ].join("\n");

    const chunks = chunkMarkdown(markdown, { chunkSizeTokens: 5, chunkOverlapTokens: 1 });

    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
    const firstIndex = markdown.indexOf("Premier paragraphe");
    const secondIndex = markdown.indexOf("Deuxième paragraphe");
    const firstChunkIdx = chunks.findIndex((c) => c.content.includes("Premier paragraphe"));
    const secondChunkIdx = chunks.findIndex((c) => c.content.includes("Deuxième paragraphe"));

    expect(firstIndex).toBeLessThan(secondIndex);
    expect(firstChunkIdx).toBeLessThan(secondChunkIdx);
  });

  it("associates each chunk with the PDF page it starts on", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.pdf"));
    const parsed = await parsePdf(buffer, "sample.pdf");

    const chunks = chunkMarkdown(parsed.markdown, {
      pages: parsed.pages,
      chunkSizeTokens: 5,
      chunkOverlapTokens: 0,
    });

    expect(chunks.some((c) => c.page === 1)).toBe(true);
    expect(chunks.some((c) => c.content.includes("Fin du document") && c.page === 2)).toBe(true);
  });
});
