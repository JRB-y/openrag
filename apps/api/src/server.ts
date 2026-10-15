import cors from "@fastify/cors";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import dbPlugin from "./plugins/db.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import queuePlugin from "./plugins/queue.js";
import healthRoute from "./routes/health.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = Fastify({ logger: true });

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
registerErrorHandler(app);

await app.register(cors);
await app.register(dbPlugin);
await app.register(queuePlugin);
await app.register(healthRoute);

await app.listen({ port: PORT, host: "0.0.0.0" });

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}
