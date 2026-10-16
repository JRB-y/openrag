import { createHash } from "node:crypto";
import {
  chunkMarkdown,
  chunks as chunksTable,
  chunkToEmbeddingText,
  db,
  documents,
  embed,
  env,
  parseDocx,
  parseHtml,
  parseMarkdown,
  parsePdf,
  parseTxt,
  parseUrl,
  storage,
  type ParseResult,
} from "@openrag/core";
import { and, eq, ne } from "drizzle-orm";
import pino from "pino";

const logger = pino({
  name: "worker",
  transport: process.env.VITEST
    ? undefined
    : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
});

async function parseStoredFile(documentId: string, mimeType: string | null): Promise<ParseResult> {
  const { filename, data } = await storage.read(documentId);

  switch (mimeType) {
    case "application/pdf":
      return parsePdf(data, filename);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return parseDocx(data, filename);
    case "text/html":
      return parseHtml(data, filename);
    case "text/markdown":
      return parseMarkdown(data, filename);
    case "text/plain":
      return parseTxt(data, filename);
    default:
      throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}

function hashMarkdown(markdown: string): string {
  return createHash("sha256").update(markdown).digest("hex");
}

// Times a step and logs its duration, so we have structured timing for
// each stage of ingestion (DOCS.md §9) without wrapping every call site
// by hand.
async function timed<T>(documentId: string, step: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await fn();
  logger.info({ documentId, step, durationMs: Date.now() - start }, "ingestion step completed");
  return result;
}

export async function ingestDocument(documentId: string): Promise<void> {
  const start = Date.now();

  await db
    .update(documents)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }

  const result = await timed(documentId, "extract", () =>
    doc.sourceType === "url" ? parseUrl(doc.sourceUri) : parseStoredFile(documentId, doc.mimeType),
  );

  const contentHash = hashMarkdown(result.markdown);

  // Re-indexing with unchanged content: nothing to redo, just confirm ready.
  if (doc.contentHash === contentHash) {
    await db
      .update(documents)
      .set({ status: "ready", title: result.title, error: null, updatedAt: new Date() })
      .where(eq(documents.id, documentId));
    logger.info({ documentId, durationMs: Date.now() - start }, "ingestion skipped: content unchanged");
    return;
  }

  // A different, already-indexed document has identical content: this
  // one is a duplicate, not a transient failure - don't retry it.
  const [original] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.contentHash, contentHash), ne(documents.id, documentId), eq(documents.status, "ready")),
    );

  if (original) {
    const message = `Duplicate of document ${original.id} ("${original.title ?? "untitled"}")`;
    await db
      .update(documents)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(documents.id, documentId));
    logger.warn({ documentId, originalId: original.id }, "ingestion stopped: duplicate content");
    return;
  }

  const documentChunks = await timed(documentId, "chunk", () =>
    Promise.resolve(chunkMarkdown(result.markdown, { pages: result.pages })),
  );

  const vectors = await timed(documentId, "embed", () =>
    embed(documentChunks.map(chunkToEmbeddingText)),
  );

  await timed(documentId, "write", () =>
    db.transaction(async (tx) => {
      await tx.delete(chunksTable).where(eq(chunksTable.documentId, documentId));

      if (documentChunks.length > 0) {
        await tx.insert(chunksTable).values(
          documentChunks.map((chunk, i) => ({
            documentId,
            chunkIndex: chunk.index,
            content: chunk.content,
            headingPath: chunk.headingPath,
            page: chunk.page,
            tokenCount: chunk.tokenCount,
            embedding: vectors[i]!,
            embeddingModel: env.EMBEDDING_MODEL,
          })),
        );
      }

      await tx
        .update(documents)
        .set({
          status: "ready",
          title: result.title,
          contentHash,
          chunkCount: documentChunks.length,
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
    }),
  );

  logger.info(
    { documentId, chunkCount: documentChunks.length, durationMs: Date.now() - start },
    "ingestion completed",
  );
}
