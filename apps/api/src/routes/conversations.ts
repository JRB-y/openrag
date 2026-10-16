import { conversations, messages } from "@openrag/core";
import { asc, desc, eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { serializeConversation, serializeMessage } from "../lib/serialize.js";

const conversationParamsSchema = z.object({ id: z.uuid() });

const conversationsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/conversations", async () => {
    const rows = await app.db.select().from(conversations).orderBy(desc(conversations.createdAt));
    return rows.map(serializeConversation);
  });

  app.get(
    "/conversations/:id",
    { schema: { params: conversationParamsSchema } },
    async (request, reply) => {
      const [conversation] = await app.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, request.params.id));

      if (!conversation) {
        return reply.status(404).send({ error: "NotFound", message: "Conversation not found" });
      }

      const conversationMessages = await app.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(asc(messages.createdAt));

      return {
        ...serializeConversation(conversation),
        messages: conversationMessages.map(serializeMessage),
      };
    },
  );

  app.delete(
    "/conversations/:id",
    { schema: { params: conversationParamsSchema } },
    async (request, reply) => {
      const [conversation] = await app.db
        .delete(conversations)
        .where(eq(conversations.id, request.params.id))
        .returning();

      if (!conversation) {
        return reply.status(404).send({ error: "NotFound", message: "Conversation not found" });
      }

      return reply.status(204).send();
    },
  );
};

export default conversationsRoutes;
