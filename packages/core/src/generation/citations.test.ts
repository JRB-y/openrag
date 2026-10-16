import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "../retrieval/types.js";
import { extractCitations } from "./citations.js";

function makeChunk(chunkId: string, documentId: string, page: number | null): RetrievedChunk {
  return {
    chunkId,
    documentId,
    documentTitle: "Doc",
    sourceType: "file",
    sourceUri: "/doc.pdf",
    content: `Contenu du chunk ${chunkId}, avec plus de texte pour tester la troncature de l'extrait à une longueur raisonnable afin de vérifier le comportement.`,
    headingPath: null,
    page,
    tokenCount: 10,
  };
}

describe("extractCitations", () => {
  const chunks = [makeChunk("c1", "d1", 1), makeChunk("c2", "d2", 2)];

  it("extracts citations in the order they appear in the context, deduplicated", () => {
    const text = "Une affirmation [1]. Une autre [2]. Et on recite [1] encore.";

    const citations = extractCitations(text, chunks);

    expect(citations).toEqual([
      expect.objectContaining({ n: 1, chunkId: "c1", documentId: "d1", page: 1 }),
      expect.objectContaining({ n: 2, chunkId: "c2", documentId: "d2", page: 2 }),
    ]);
  });

  it("ignores a citation number outside the provided context (hallucinated or zero)", () => {
    const text = "Une affirmation [1], une autre inventée [5], et une invalide [0].";

    const citations = extractCitations(text, chunks);

    expect(citations.map((c) => c.n)).toEqual([1]);
  });

  it("returns an empty array when the text has no citation marker", () => {
    expect(extractCitations("Réponse sans aucune citation.", chunks)).toEqual([]);
  });

  it("truncates the excerpt to a reasonable length", () => {
    const citations = extractCitations("Affirmation [1].", chunks);

    expect(citations[0]!.excerpt.length).toBeLessThanOrEqual(200);
  });
});
