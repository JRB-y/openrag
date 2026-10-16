import { randomUUID } from "node:crypto";
import { chunks, db, documents, env, storage } from "@openrag/core";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { ingestDocument } from "./ingest.js";

// Integration test against the real pipeline (extract -> chunk -> embed ->
// write) with a real Postgres and a real Ollama - requires `pnpm infra:up`.
describe("ingestDocument", () => {
  const documentId = randomUUID();

  afterAll(async () => {
    await db.delete(documents).where(eq(documents.id, documentId));
    await storage.delete(documentId);
  });

  it(
    "parses, chunks, embeds and marks a document ready end to end",
    async () => {
      const markdown = [
        "# Politique de congés",
        "",
        "Les congés payés sont de 5 semaines par an.",
        "",
        "## Mineurs",
        "",
        "Les mineurs ont 2 jours de congé supplémentaires.",
        "",
      ].join("\n");

      const storedPath = await storage.save(documentId, "fixture.md", Buffer.from(markdown));
      await db.insert(documents).values({
        id: documentId,
        sourceType: "file",
        sourceUri: storedPath,
        title: "fixture.md",
        mimeType: "text/markdown",
        status: "pending",
      });

      await ingestDocument(documentId);

      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
      expect(doc?.status).toBe("ready");
      expect(doc?.chunkCount).toBeGreaterThan(0);

      const rows = await db.select().from(chunks).where(eq(chunks.documentId, documentId));
      expect(rows).toHaveLength(doc!.chunkCount!);
      expect(rows[0]?.embedding).toHaveLength(env.EMBEDDING_DIMENSIONS);
      expect(rows.some((r) => r.headingPath?.includes("Mineurs"))).toBe(true);
    },
    30_000,
  );
});
