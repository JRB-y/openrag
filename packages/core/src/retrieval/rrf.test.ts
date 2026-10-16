import { describe, expect, it } from "vitest";
import { fuseRankedLists } from "./rrf.js";
import type { RetrievedChunk } from "./types.js";

function makeChunk(chunkId: string): RetrievedChunk {
  return {
    chunkId,
    documentId: "doc-1",
    documentTitle: "Doc",
    sourceType: "file",
    sourceUri: "/doc.pdf",
    content: `content ${chunkId}`,
    headingPath: null,
    page: null,
    tokenCount: 10,
  };
}

describe("fuseRankedLists", () => {
  it("ranks a chunk present in both lists above one present in only one", () => {
    const vectorResults = [makeChunk("a"), makeChunk("b"), makeChunk("c")];
    const fullTextResults = [makeChunk("b"), makeChunk("d")];

    const fused = fuseRankedLists([vectorResults, fullTextResults]);

    expect(fused[0]!.chunkId).toBe("b");
  });

  it("deduplicates a chunk that appears in multiple lists", () => {
    const vectorResults = [makeChunk("a"), makeChunk("b")];
    const fullTextResults = [makeChunk("a"), makeChunk("c")];

    const fused = fuseRankedLists([vectorResults, fullTextResults]);

    expect(fused.map((c) => c.chunkId).sort()).toEqual(["a", "b", "c"]);
    expect(new Set(fused.map((c) => c.chunkId)).size).toBe(fused.length);
  });

  it("falls back to single-list rank order when there is no overlap", () => {
    const vectorResults = [makeChunk("a"), makeChunk("b")];

    const fused = fuseRankedLists([vectorResults]);

    expect(fused.map((c) => c.chunkId)).toEqual(["a", "b"]);
  });

  it("gives a higher rank-1 score a bigger boost than a lower rank with a smaller k", () => {
    const list = [makeChunk("first"), makeChunk("second")];

    const fused = fuseRankedLists([list], 1);

    // With k=1, rank 1 scores 1/2 and rank 2 scores 1/3 - a wide enough
    // gap to assert ordering is driven by rank, not insertion order.
    expect(fused.map((c) => c.chunkId)).toEqual(["first", "second"]);
  });
});
