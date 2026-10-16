import { describe, expect, it } from "vitest";
import type { StructuredTextItem } from "unpdf";
import { applyHeadingMarkup, detectHeadingLines } from "./pdf-headings.js";

function item(str: string, fontSize: number, hasEOL = false): StructuredTextItem {
  return { str, x: 0, y: 0, width: 0, height: 0, fontSize, fontFamily: "", dir: "ltr", hasEOL };
}

function bodyLines(count: number): StructuredTextItem[] {
  return Array.from({ length: count }, (_, i) => item(`Paragraphe de corps numéro ${i}.`, 11, true));
}

describe("detectHeadingLines", () => {
  it("classifies lines noticeably bigger than body text as headings, biggest first", () => {
    const page = [item("Titre du document", 24, true), item("Section", 18, true), ...bodyLines(10)];

    const depths = detectHeadingLines([page]);

    expect(depths.get("Titre du document")).toBe(1);
    expect(depths.get("Section")).toBe(2);
    expect(depths.has("Paragraphe de corps numéro 0.")).toBe(false);
  });

  it("caps heading depth at 3 even with more than 3 distinct larger sizes", () => {
    const page = [
      item("Niveau un", 30, true),
      item("Niveau deux", 24, true),
      item("Niveau trois", 18, true),
      item("Niveau quatre", 16, true),
      ...bodyLines(15),
    ];

    const depths = detectHeadingLines([page]);

    expect(depths.get("Niveau un")).toBe(1);
    expect(depths.get("Niveau deux")).toBe(2);
    expect(depths.get("Niveau trois")).toBe(3);
    expect(depths.get("Niveau quatre")).toBe(3);
  });

  it("backs off entirely when most lines look oversized (uniform large font)", () => {
    const page = [
      item("Ligne un en gros texte.", 20, true),
      item("Ligne deux en gros texte.", 20, true),
      item("Ligne trois en gros texte.", 20, true),
      item("Seule ligne de corps normal.", 11, true),
    ];

    const depths = detectHeadingLines([page]);

    expect(depths.size).toBe(0);
  });

  it("returns an empty map for a page with no text", () => {
    expect(detectHeadingLines([[]])).toEqual(new Map());
  });
});

describe("applyHeadingMarkup", () => {
  it("prefixes a matching line with the right number of #", () => {
    const pageText = "Titre du document\nUn paragraphe de corps de texte normal.";
    const depths = new Map([["Titre du document", 1]]);

    const result = applyHeadingMarkup(pageText, depths);

    expect(result).toBe("# Titre du document\nUn paragraphe de corps de texte normal.");
  });

  it("matches despite minor whitespace differences", () => {
    const pageText = "Titre   du    document\nCorps.";
    const depths = new Map([["Titre du document", 1]]);

    const result = applyHeadingMarkup(pageText, depths);

    expect(result.split("\n")[0]).toBe("# Titre   du    document");
  });

  it("is a no-op when no headings were detected", () => {
    const pageText = "Juste du texte normal.";

    expect(applyHeadingMarkup(pageText, new Map())).toBe(pageText);
  });
});
