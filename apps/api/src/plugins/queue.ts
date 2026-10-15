import fp from "fastify-plugin";
import { createIngestionQueue } from "@openrag/core";

declare module "fastify" {
  interface FastifyInstance {
    queue: ReturnType<typeof createIngestionQueue>;
  }
}

export default fp(async (app) => {
  const queue = createIngestionQueue();

  app.decorate("queue", queue);
  app.addHook("onClose", async () => {
    await queue.close();
  });
});
