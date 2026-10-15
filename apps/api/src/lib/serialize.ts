import type { ChunkSummaryDTO, DocumentDTO, chunks, documents } from "@openrag/core";

export function serializeDocument(doc: typeof documents.$inferSelect): DocumentDTO {
  return {
    ...doc,
    sourceType: doc.sourceType as DocumentDTO["sourceType"],
    status: doc.status as DocumentDTO["status"],
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

type ChunkSummary = Pick<
  typeof chunks.$inferSelect,
  "id" | "chunkIndex" | "content" | "headingPath" | "page" | "tokenCount" | "createdAt"
>;

export function serializeChunk(chunk: ChunkSummary): ChunkSummaryDTO {
  return {
    ...chunk,
    createdAt: chunk.createdAt.toISOString(),
  };
}
