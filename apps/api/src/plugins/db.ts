import fp from "fastify-plugin";
import { db } from "@openrag/core";

declare module "fastify" {
  interface FastifyInstance {
    db: typeof db;
  }
}

export default fp(async (app) => {
  app.decorate("db", db);
});
