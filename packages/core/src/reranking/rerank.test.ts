import { beforeAll, describe, expect, it } from "vitest";
import type { RetrievedChunk } from "../retrieval/types.js";
import { rerank } from "./rerank.js";

function makeChunk(chunkId: string, content: string): RetrievedChunk {
  return {
    chunkId,
    documentId: "doc-1",
    documentTitle: "Doc",
    sourceType: "file",
    sourceUri: "/doc.pdf",
    content,
    headingPath: null,
    page: null,
    tokenCount: 10,
  };
}

// Integration test against the real bge-reranker-base ONNX model
// (downloaded once, then cached locally) - same philosophy as the
// embeddings/hybrid-search tests: no mocking of the thing we're
// actually trying to validate.
describe("rerank", () => {
  beforeAll(async () => {
    // Warm up the singleton model so its one-time load cost doesn't
    // leak into the latency assertion below.
    await rerank("warmup", [makeChunk("warmup", "warmup content")]);
  }, 60_000);

  it("ranks a clearly relevant chunk above an irrelevant one, and drops the irrelevant one", async () => {
    const candidates = [
      makeChunk("fiscal", "La recette de la tarte aux pommes nécessite 3 pommes et de la cannelle."),
      makeChunk("vacances", "Les congés payés représentent 5 semaines de repos chaque année."),
    ];

    const results = await rerank("Quelle est la durée des congés payés ?", candidates);

    expect(results.map((r) => r.chunkId)).toEqual(["vacances"]);
    expect(results[0]!.rerankScore).toBeGreaterThan(0.3);
  });

  it("returns an empty array when nothing passes RERANK_MIN_SCORE", async () => {
    const candidates = [
      makeChunk("a", "La recette de la tarte aux pommes nécessite 3 pommes."),
      makeChunk("b", "Le chat dort sur le canapé toute la journée."),
    ];

    const results = await rerank("Quel est le délai de livraison du colis ?", candidates);

    expect(results).toEqual([]);
  });

  it("returns an empty array immediately for an empty candidate list", async () => {
    expect(await rerank("peu importe", [])).toEqual([]);
  });

  it("caps the result at RERANK_TOP_N even when more candidates pass the threshold", async () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      makeChunk(`c${i}`, `Les congés payés représentent ${i + 1} semaines de repos chaque année.`),
    );

    const results = await rerank("Quelle est la durée des congés payés ?", candidates);

    expect(results.length).toBeLessThanOrEqual(5); // RERANK_TOP_N in .env.example
    expect(results.length).toBeGreaterThan(0);
  });

  it("scores 30 candidates in a reasonable time", async () => {
    // DOCS.md §11's target is <1s on CPU, measured at fp32 around
    // ~1.02s in practice - fp32 was chosen over the faster q8 dtype
    // because q8's scores shifted depending on batch composition
    // (see model.ts). This asserts a looser bound so the test reflects
    // the deliberate speed/determinism tradeoff instead of flaking on
    // a target we knowingly don't hit to the millisecond.
    const candidates = Array.from({ length: 30 }, (_, i) =>
      makeChunk(
        `perf-${i}`,
        `Ceci est un passage de test numéro ${i} avec un peu de contenu pour simuler un vrai chunk de taille normale, représentatif d'un extrait de document réel.`,
      ),
    );

    const start = performance.now();
    await rerank("Quelles sont les priorités des microservices ?", candidates);
    const durationMs = performance.now() - start;

    expect(durationMs).toBeLessThan(2000);
  });
});
