import { env } from "../config.js";
import { embed } from "../embeddings/embed.js";
import { fullTextSearch } from "./fulltext-search.js";
import { fuseRankedLists } from "./rrf.js";
import type { RetrievedChunk } from "./types.js";
import { vectorSearch } from "./vector-search.js";

export async function hybridSearch(query: string): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embed([query]);

  const [vectorResults, fullTextResults] = await Promise.all([
    vectorSearch(queryEmbedding!, env.RETRIEVAL_TOP_K),
    fullTextSearch(query, env.RETRIEVAL_TOP_K),
  ]);

  return fuseRankedLists([vectorResults, fullTextResults]);
}
