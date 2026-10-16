import { env } from "../config.js";
import type { RetrievedChunk } from "../retrieval/types.js";
import { getRerankerModel } from "./model.js";

export interface RerankedChunk extends RetrievedChunk {
  rerankScore: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// Cross-encoder reranking: scores each (query, chunk) pair directly
// (unlike embeddings, which score query and chunk independently), so
// it's slower but more accurate - used to re-sort the hybrid search's
// candidates, not to search the whole corpus. The raw logit is mapped
// to [0, 1] via sigmoid so RERANK_MIN_SCORE has a stable scale.
export async function rerank(
  query: string,
  candidates: RetrievedChunk[],
): Promise<RerankedChunk[]> {
  if (candidates.length === 0) return [];

  const { tokenizer, model } = await getRerankerModel();

  const inputs = tokenizer(Array(candidates.length).fill(query) as string[], {
    text_pair: candidates.map((c) => c.content),
    padding: true,
    truncation: true,
  });
  const { logits } = await model(inputs);

  const scores = (logits.tolist() as number[][]).map(([logit]) => sigmoid(logit!));

  return candidates
    .map((chunk, i) => ({ ...chunk, rerankScore: scores[i]! }))
    .filter((chunk) => chunk.rerankScore >= env.RERANK_MIN_SCORE)
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, env.RERANK_TOP_N);
}
