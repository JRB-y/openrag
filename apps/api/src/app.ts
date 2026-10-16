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
  // Pino's default output is one JSON object per line - great for a log
  // aggregator, unreadable in a terminal. pino-pretty reformats it for
  // the dev console; not used in tests to avoid the extra worker thread.
  const app = Fastify({
    logger: process.env.VITEST
      ? true
      : {
          transport: {
            target: "pino-pretty",
            options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
          },
        },
  });

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
