import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "@openrag/core";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import dbPlugin from "./plugins/db.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import queuePlugin from "./plugins/queue.js";
import documentsRoutes from "./routes/documents.js";
import healthRoute from "./routes/health.js";
import searchRoute from "./routes/search.js";

const PORT = Number(process.env.PORT ?? 3001);

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

await app.listen({ port: PORT, host: "0.0.0.0" });

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}
