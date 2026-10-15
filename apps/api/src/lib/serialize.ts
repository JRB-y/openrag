import type { chunks, documents } from "@openrag/core";

export function serializeDocument(doc: typeof documents.$inferSelect) {
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

type ChunkSummary = Pick<
  typeof chunks.$inferSelect,
  "id" | "chunkIndex" | "content" | "headingPath" | "page" | "tokenCount" | "createdAt"
>;

export function serializeChunk(chunk: ChunkSummary) {
  return {
    ...chunk,
    createdAt: chunk.createdAt.toISOString(),
  };
}
