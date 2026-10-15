import { randomUUID } from "node:crypto";
import { assertPublicHttpUrl, chunks, documents, storage, UnsafeUrlError } from "@openrag/core";
import { desc, eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { detectMimeType } from "../lib/mime.js";
import { serializeChunk, serializeDocument } from "../lib/serialize.js";

const documentParamsSchema = z.object({ id: z.uuid() });

const errorResponseSchema = z.object({ error: z.string(), message: z.string() });

const uploadResponseSchema = z.object({
  documents: z.array(z.object({ id: z.uuid(), title: z.string().nullable() })),
});

const urlBodySchema = z.object({ url: z.url() });

const chunksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const documentsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/documents/upload",
    {
      schema: {
        response: { 201: uploadResponseSchema, 400: errorResponseSchema, 415: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const created: { id: string; title: string | null }[] = [];

      for await (const part of request.parts()) {
        if (part.type !== "file") continue;

        const buffer = await part.toBuffer();
        const mimeType = await detectMimeType(buffer, part.filename);

        if (!mimeType) {
          return reply.status(415).send({
            error: "UnsupportedMediaType",
            message: `Unsupported file type: ${part.filename}`,
          });
        }

        const documentId = randomUUID();
        const storedPath = await storage.save(documentId, part.filename, buffer);

        const [doc] = await app.db
          .insert(documents)
          .values({
            id: documentId,
            sourceType: "file",
            sourceUri: storedPath,
            title: part.filename,
            mimeType,
            status: "pending",
          })
          .returning();

        await app.queue.add("ingest", { documentId });
        created.push({ id: doc!.id, title: doc!.title });
      }

      if (created.length === 0) {
        return reply.status(400).send({ error: "BadRequest", message: "No file was uploaded" });
      }

      return reply.status(201).send({ documents: created });
    },
  );

  app.post(
    "/documents/url",
    {
      schema: {
        body: urlBodySchema,
        response: { 201: z.object({ id: z.uuid() }), 400: errorResponseSchema },
      },
    },
    async (request, reply) => {
      let safeUrl: URL;
      try {
        safeUrl = await assertPublicHttpUrl(request.body.url);
      } catch (err) {
        if (err instanceof UnsafeUrlError) {
          return reply.status(400).send({ error: "UnsafeUrl", message: err.message });
        }
        throw err;
      }

      const documentId = randomUUID();
      const [doc] = await app.db
        .insert(documents)
        .values({
          id: documentId,
          sourceType: "url",
          sourceUri: safeUrl.toString(),
          status: "pending",
        })
        .returning();

      await app.queue.add("ingest", { documentId });
      return reply.status(201).send({ id: doc!.id });
    },
  );

  app.get("/documents", async () => {
    const rows = await app.db.select().from(documents).orderBy(desc(documents.createdAt));
    return rows.map(serializeDocument);
  });

  app.get(
    "/documents/:id",
    { schema: { params: documentParamsSchema, querystring: chunksQuerySchema } },
    async (request, reply) => {
      const [doc] = await app.db
        .select()
        .from(documents)
        .where(eq(documents.id, request.params.id));

      if (!doc) {
        return reply.status(404).send({ error: "NotFound", message: "Document not found" });
      }

      const { limit, offset } = request.query;
      const documentChunks = await app.db
        .select({
          id: chunks.id,
          chunkIndex: chunks.chunkIndex,
          content: chunks.content,
          headingPath: chunks.headingPath,
          page: chunks.page,
          tokenCount: chunks.tokenCount,
          createdAt: chunks.createdAt,
        })
        .from(chunks)
        .where(eq(chunks.documentId, doc.id))
        .orderBy(chunks.chunkIndex)
        .limit(limit)
        .offset(offset);

      return {
        ...serializeDocument(doc),
        chunks: documentChunks.map(serializeChunk),
      };
    },
  );

  app.delete(
    "/documents/:id",
    { schema: { params: documentParamsSchema } },
    async (request, reply) => {
      const [doc] = await app.db
        .delete(documents)
        .where(eq(documents.id, request.params.id))
        .returning();

      if (!doc) {
        return reply.status(404).send({ error: "NotFound", message: "Document not found" });
      }

      await storage.delete(doc.id);
      return reply.status(204).send();
    },
  );

  app.post(
    "/documents/:id/reindex",
    { schema: { params: documentParamsSchema } },
    async (request, reply) => {
      const [doc] = await app.db
        .update(documents)
        .set({ status: "pending", error: null, updatedAt: new Date() })
        .where(eq(documents.id, request.params.id))
        .returning();

      if (!doc) {
        return reply.status(404).send({ error: "NotFound", message: "Document not found" });
      }

      await app.queue.add("ingest", { documentId: doc.id });
      return serializeDocument(doc);
    },
  );
};

export default documentsRoutes;
