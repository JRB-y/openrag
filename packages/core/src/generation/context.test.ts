import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "../retrieval/types.js";
import { buildContext } from "./context.js";

function makeChunk(overrides: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    chunkId: "c1",
    documentId: "d1",
    documentTitle: "Guide RH",
    sourceType: "file",
    sourceUri: "/guide-rh.pdf",
    content: "Contenu du chunk.",
    headingPath: null,
    page: null,
    tokenCount: 10,
    ...overrides,
  };
}

describe("buildContext", () => {
  it("numbers chunks from 1 and includes title, page and heading", () => {
    const context = buildContext([
      makeChunk({ documentTitle: "Guide RH", page: 12, headingPath: "Congés > Congés payés" }),
    ]);

    expect(context).toBe(
      "[1] (Guide RH, p. 12, Congés > Congés payés)\nContenu du chunk.",
    );
  });

  it("uses the URL as the source for url documents, and omits missing parts", () => {
    const context = buildContext([
      makeChunk({
        sourceType: "url",
        sourceUri: "https://exemple.com/faq",
        documentTitle: null,
        page: null,
        headingPath: "FAQ > Absences",
      }),
    ]);

    expect(context).toBe("[1] (https://exemple.com/faq, FAQ > Absences)\nContenu du chunk.");
  });

  it("joins multiple chunks with a blank line, keeping sequential numbering", () => {
    const context = buildContext([
      makeChunk({ chunkId: "c1", content: "Premier contenu." }),
      makeChunk({ chunkId: "c2", content: "Second contenu." }),
    ]);

    expect(context).toBe("[1] (Guide RH)\nPremier contenu.\n\n[2] (Guide RH)\nSecond contenu.");
  });
});
