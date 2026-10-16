import { hybridSearch } from "@openrag/core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const searchQuerySchema = z.object({
  q: z.string().min(1),
});

const resultSchema = z.object({
  chunkId: z.uuid(),
  documentId: z.uuid(),
  documentTitle: z.string().nullable(),
  sourceType: z.enum(["file", "url"]),
  sourceUri: z.string(),
  content: z.string(),
  headingPath: z.string().nullable(),
  page: z.number().nullable(),
  tokenCount: z.number().nullable(),
});

const searchRoute: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/search",
    { schema: { querystring: searchQuerySchema, response: { 200: z.array(resultSchema) } } },
    async (request) => hybridSearch(request.query.q),
  );
};

export default searchRoute;
