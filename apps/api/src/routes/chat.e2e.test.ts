import { randomUUID } from "node:crypto";
import {
  chunks,
  type Citation,
  conversations,
  db,
  documents,
  embed,
  env,
  messages,
} from "@openrag/core";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

// Integration test exercising the whole chat pipeline through the real
// HTTP layer (rewrite -> hybridSearch -> rerank -> generateAnswer -> SSE
// stream -> persistence) - requires `pnpm infra:up`. Seeds a chunk
// directly rather than re-running ingestion, since that's already
// covered by apps/worker/src/ingest.e2e.test.ts.
describe("POST /chat (end to end)", () => {
  let app: FastifyInstance;
  const documentId = randomUUID();

  beforeAll(async () => {
    app = await buildApp();

    await db.insert(documents).values({
      id: documentId,
      sourceType: "file",
      sourceUri: "/test/chat-e2e-fixture.md",
      title: "Fixture congés",
      mimeType: "text/markdown",
      status: "ready",
    });

    const content = "Les congés payés sont de 5 semaines par an, plus 2 jours pour les mineurs.";
    const [vector] = await embed([content]);

    await db.insert(chunks).values({
      documentId,
      chunkIndex: 0,
      content,
      embeddingModel: env.EMBEDDING_MODEL,
      embedding: vector!,
    });
  });

  afterAll(async () => {
    await db.delete(documents).where(eq(documents.id, documentId));
    await app.close();
  });

  it(
    "streams an answer, cites the fixture chunk and persists the exchange",
    async () => {
      const res = await app.inject({
        method: "POST",
        url: "/chat",
        payload: { message: "Combien de semaines de congés payés par an ?" },
      });

      expect(res.statusCode).toBe(200);

      const events = res.payload
        .split("\n\n")
        .filter((frame) => frame.startsWith("data: "))
        .map((frame) => JSON.parse(frame.slice("data: ".length)) as { type: string; value: unknown });

      const conversationId = events.find((e) => e.type === "conversationId")?.value as string;
      const citations = events.find((e) => e.type === "citations")?.value as Citation[];

      expect(conversationId).toBeTruthy();
      expect(citations).toEqual(expect.arrayContaining([expect.objectContaining({ documentId })]));

      const persisted = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId));
      expect(persisted).toHaveLength(2);

      const assistantMessage = persisted.find((m) => m.role === "assistant");
      expect(assistantMessage?.content.length).toBeGreaterThan(0);
      expect((assistantMessage?.citations as Citation[] | null)?.length).toBeGreaterThan(0);

      await db.delete(conversations).where(eq(conversations.id, conversationId));
    },
    60_000,
  );
});
