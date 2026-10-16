import type { RetrievedChunk } from "../retrieval/types.js";
import type { Citation } from "./types.js";

const EXCERPT_LENGTH = 200;

// Finds every [n] the LLM actually used in its answer and maps it back
// to the chunk that was numbered n in buildContext(). A citation to a
// number outside the provided context (hallucinated or out of range)
// is dropped rather than crashing - the model occasionally invents one.
export function extractCitations(responseText: string, chunks: RetrievedChunk[]): Citation[] {
  const citedNumbers = new Set<number>();

  for (const match of responseText.matchAll(/\[(\d+)\]/g)) {
    citedNumbers.add(Number(match[1]));
  }

  return [...citedNumbers]
    .filter((n) => n >= 1 && n <= chunks.length)
    .sort((a, b) => a - b)
    .map((n) => {
      const chunk = chunks[n - 1]!;
      return {
        n,
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        page: chunk.page,
        excerpt: chunk.content.slice(0, EXCERPT_LENGTH),
      };
    });
}
