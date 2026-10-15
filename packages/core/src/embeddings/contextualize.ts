import type { Chunk } from "../chunking/types.js";

// A chunk saying "Le délai est de 30 jours" is hard to find by itself;
// prefixing it with its heading breadcrumb makes it match a question
// about "le délai de remboursement" too (DOCS.md §5).
export function chunkToEmbeddingText(chunk: Pick<Chunk, "headingPath" | "content">): string {
  return chunk.headingPath ? `${chunk.headingPath}\n\n${chunk.content}` : chunk.content;
}
