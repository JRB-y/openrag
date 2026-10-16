import type { RetrievedChunk } from "../retrieval/types.js";

// Numbers each chunk as [n] (source, page, heading)\ncontent, matching
// DOCS.md §6.4 - the numbering is what lets the LLM cite back with
// [n], and what extractCitations() later maps back to a real chunk.
export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const source = chunk.sourceType === "url" ? chunk.sourceUri : (chunk.documentTitle ?? chunk.sourceUri);
      const parts = [source, chunk.page !== null ? `p. ${chunk.page}` : null, chunk.headingPath].filter(
        (p): p is string => p !== null,
      );

      return `[${i + 1}] (${parts.join(", ")})\n${chunk.content}`;
    })
    .join("\n\n");
}
