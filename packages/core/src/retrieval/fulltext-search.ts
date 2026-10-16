import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { chunks, documents } from "../db/schema.js";
import type { RetrievedChunk } from "./types.js";

// Full-text match against the GIN-indexed tsv column, ranked by
// ts_rank_cd - DOCS.md §10. websearch_to_tsquery understands plain
// natural-language queries (quotes, -exclusion, etc.) without the
// caller needing to build a tsquery string by hand.
export async function fullTextSearch(query: string, limit: number): Promise<RetrievedChunk[]> {
  const tsQuery = sql`websearch_to_tsquery('simple', ${query})`;

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
    .where(sql`${chunks.tsv} @@ ${tsQuery}`)
    .orderBy(desc(sql`ts_rank_cd(${chunks.tsv}, ${tsQuery})`))
    .limit(limit);

  return rows as RetrievedChunk[];
}
