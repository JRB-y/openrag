import type { FastifyError, FastifyInstance } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";

// Uniform error shape for every response: { error, message }.
// 5xx messages are genericized so we never leak internals to clients.
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError, _request, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      reply.status(400).send({ error: "ValidationError", message: err.message });
      return;
    }

    const statusCode = err.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(err);
    }

    reply.status(statusCode).send({
      error: err.name ?? "Error",
      message: statusCode >= 500 ? "Internal server error" : err.message,
    });
  });
}
