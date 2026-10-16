import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../config.js";
import { db } from "../db/client.js";
import { chunks, documents } from "../db/schema.js";
import { embed } from "../embeddings/embed.js";
import { hybridSearch } from "./hybrid-search.js";

// Integration test against a real Postgres (pgvector + tsvector) and a
// real Ollama embedding model - this is exactly the scenario DOCS.md §10
// asks to validate: an exact-code question found via full text, and a
// paraphrased question found via vectors. Requires `pnpm infra:up`.
describe("hybridSearch", () => {
  const documentId = randomUUID();
  let exactCodeChunkId: string;
  let paraphraseChunkId: string;
  let distractorChunkId: string;

  beforeAll(async () => {
    await db.insert(documents).values({
      id: documentId,
      sourceType: "file",
      sourceUri: "/test/hybrid-search-fixture.md",
      title: "Fixture recherche hybride",
      mimeType: "text/markdown",
      status: "ready",
    });

    const contents = [
      "Le code de référence de ce contrat est REF-2024-0042.",
      "Les congés payés sont de 5 semaines par an.",
      "La recette de la tarte aux pommes nécessite 3 pommes et de la cannelle.",
    ];
    const vectors = await embed(contents);

    const [exactCodeChunk, paraphraseChunk, distractorChunk] = (
      await db
        .insert(chunks)
        .values(
          contents.map((content, i) => ({
            documentId,
            chunkIndex: i,
            content,
            embedding: vectors[i]!,
            embeddingModel: env.EMBEDDING_MODEL,
          })),
        )
        .returning()
    ).sort((a, b) => a.chunkIndex - b.chunkIndex);

    exactCodeChunkId = exactCodeChunk!.id;
    paraphraseChunkId = paraphraseChunk!.id;
    distractorChunkId = distractorChunk!.id;
  });

  afterAll(async () => {
    await db.delete(documents).where(eq(documents.id, documentId));
  });

  it("finds a chunk containing an exact reference code via full text", async () => {
    const results = await hybridSearch("REF-2024-0042");

    expect(results.slice(0, 3).map((r) => r.chunkId)).toContain(exactCodeChunkId);
    expect(results[0]!.chunkId).toBe(exactCodeChunkId);
  });

  it("finds a paraphrased question's chunk via vector similarity", async () => {
    const results = await hybridSearch("Combien de semaines de vacances a-t-on par an ?");

    expect(results.slice(0, 3).map((r) => r.chunkId)).toContain(paraphraseChunkId);
  });

  it("does not rank an unrelated chunk above the relevant ones", async () => {
    const results = await hybridSearch("Combien de semaines de vacances a-t-on par an ?");

    const distractorRank = results.findIndex((r) => r.chunkId === distractorChunkId);
    const paraphraseRank = results.findIndex((r) => r.chunkId === paraphraseChunkId);

    expect(paraphraseRank).toBeLessThan(distractorRank === -1 ? Infinity : distractorRank);
  });
});
