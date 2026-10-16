import type { RetrievedChunk } from "./types.js";

export const RRF_K = 60;

// Reciprocal Rank Fusion: combines several ranked lists into one by
// rank, not by raw score, so it doesn't matter that cosine distance
// and ts_rank_cd live on completely different scales. A chunk that
// ranks well in more than one list accumulates a higher combined
// score than one that only ranks well in a single list. Also
// deduplicates chunks that appear in more than one input list.
export function fuseRankedLists(lists: RetrievedChunk[][], k = RRF_K): RetrievedChunk[] {
  const scoreByChunkId = new Map<string, number>();
  const chunkById = new Map<string, RetrievedChunk>();

  for (const list of lists) {
    list.forEach((chunk, i) => {
      const rank = i + 1;
      scoreByChunkId.set(chunk.chunkId, (scoreByChunkId.get(chunk.chunkId) ?? 0) + 1 / (k + rank));
      chunkById.set(chunk.chunkId, chunk);
    });
  }

  return [...scoreByChunkId.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([chunkId]) => chunkById.get(chunkId)!);
}
