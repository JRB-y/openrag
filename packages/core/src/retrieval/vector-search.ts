import { cosineDistance, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { chunks, documents } from "../db/schema.js";
import type { RetrievedChunk } from "./types.js";

// Nearest neighbors by cosine distance, using the HNSW index on
// chunks.embedding (vector_cosine_ops) - DOCS.md §10.
export async function vectorSearch(queryEmbedding: number[], limit: number): Promise<RetrievedChunk[]> {
  const rows = await db
    .select({
      chunkId: chunks.id,
      documentId: chunks.documentId,
      documentTitle: documents.title,
      sourceType: documents.sourceType,
      sourceUri: documents.sourceUri,
      content: chunks.content,
      headingPath: chunks.headingPath,
      page: chunks.page,
      tokenCount: chunks.tokenCount,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .orderBy(cosineDistance(chunks.embedding, queryEmbedding))
    .limit(limit);

  return rows as RetrievedChunk[];
}
