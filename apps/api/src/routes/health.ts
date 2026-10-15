import net from "node:net";
import { sql } from "drizzle-orm";
import { db, env } from "@openrag/core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const statusSchema = z.enum(["ok", "error"]);
const healthSchema = z.object({
  postgres: statusSchema,
  redis: statusSchema,
  ollama: statusSchema,
});

async function checkPostgres(client: typeof db) {
  try {
    await client.execute(sql`select 1`);
    return "ok" as const;
  } catch {
    return "error" as const;
  }
}

// No Redis client is installed yet (comes with BullMQ in step 4), so we
// speak just enough of the RESP protocol by hand: connect, send PING,
// expect +PONG.
async function checkRedis(redisUrl: string) {
  return new Promise<"ok" | "error">((resolve) => {
    const { hostname, port } = new URL(redisUrl);
    const socket = net.createConnection({ host: hostname, port: Number(port), timeout: 1000 });
    let settled = false;
    const finish = (status: "ok" | "error") => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(status);
    };

    socket.on("connect", () => socket.write("PING\r\n"));
    socket.on("data", (data) => finish(data.toString().startsWith("+PONG") ? "ok" : "error"));
    socket.on("error", () => finish("error"));
    socket.on("timeout", () => finish("error"));
  });
}

async function checkOllama(baseUrl: string) {
  try {
    const res = await fetch(new URL("/api/tags", baseUrl), { signal: AbortSignal.timeout(1000) });
    return res.ok ? ("ok" as const) : ("error" as const);
  } catch {
    return "error" as const;
  }
}

const healthRoute: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        response: {
          200: healthSchema,
          503: healthSchema,
        },
      },
    },
    async (_request, reply) => {
      const [postgres, redis, ollama] = await Promise.all([
        checkPostgres(app.db),
        checkRedis(env.REDIS_URL),
        checkOllama(env.OLLAMA_BASE_URL),
      ]);

      const services = { postgres, redis, ollama };
      const healthy = Object.values(services).every((status) => status === "ok");

      reply.status(healthy ? 200 : 503).send(services);
    },
  );
};

export default healthRoute;
