import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "@openrag/core";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import dbPlugin from "./plugins/db.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import queuePlugin from "./plugins/queue.js";
import chatRoutes from "./routes/chat.js";
import conversationsRoutes from "./routes/conversations.js";
import documentsRoutes from "./routes/documents.js";
import healthRoute from "./routes/health.js";
import searchRoute from "./routes/search.js";

// Split out from server.ts so integration tests can build the app and use
// `.inject()` without actually binding a port.
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(cors, {
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(multipart, {
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  });
  await app.register(dbPlugin);
  await app.register(queuePlugin);
  await app.register(healthRoute);
  await app.register(documentsRoutes);
  await app.register(searchRoute);
  await app.register(chatRoutes);
  await app.register(conversationsRoutes);

  return app;
}
