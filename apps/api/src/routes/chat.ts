import {
  type ChatMessage,
  conversations,
  generateAnswer,
  hybridSearch,
  messages,
  rerank,
  rewriteQuestion,
} from "@openrag/core";
import { desc, eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

// How many previous messages feed the question-rewrite step - just
// enough recent context for a follow-up like "Et pour les mineurs ?",
// without growing the rewrite prompt unbounded over a long conversation.
const HISTORY_LIMIT = 10;
const TITLE_LENGTH = 60;

const chatBodySchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().min(1),
});

function titleFromMessage(message: string): string {
  return message.length > TITLE_LENGTH ? `${message.slice(0, TITLE_LENGTH)}…` : message;
}

const chatRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post("/chat", { schema: { body: chatBodySchema } }, async (request, reply) => {
    const { message } = request.body;

    let conversationId = request.body.conversationId;
    let history: ChatMessage[] = [];

    if (conversationId) {
      const [conversation] = await app.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId));

      if (!conversation) {
        return reply.status(404).send({ error: "NotFound", message: "Conversation not found" });
      }

      const previousMessages = await app.db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(HISTORY_LIMIT);

      // Fetched newest-first to apply the limit to the most recent
      // messages; put back in chronological order for the rewrite prompt.
      history = previousMessages.reverse() as ChatMessage[];
    } else {
      const [conversation] = await app.db
        .insert(conversations)
        .values({ title: titleFromMessage(message) })
        .returning();
      conversationId = conversation!.id;
    }

    await app.db.insert(messages).values({ conversationId, role: "user", content: message });

    const abortController = new AbortController();
    request.raw.on("close", () => abortController.abort());

    const standaloneQuestion = await rewriteQuestion(history, message);
    const candidates = await hybridSearch(standaloneQuestion);
    const rerankedChunks = await rerank(standaloneQuestion, candidates);
    const result = generateAnswer(standaloneQuestion, rerankedChunks, {
      abortSignal: abortController.signal,
    });

    // hijack() bypasses @fastify/cors's onSend hook entirely (it only
    // runs for responses Fastify sends itself), so the Access-Control
    // header has to be set by hand here too, or the browser's fetch
    // rejects the cross-origin response outright.
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": request.headers.origin ?? "*",
    });

    function sendEvent(payload: unknown) {
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    sendEvent({ type: "conversationId", value: conversationId });

    try {
      for await (const delta of result.textStream) {
        sendEvent({ type: "text", value: delta });
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        return; // client disconnected, nothing left to send
      }
      throw err;
    }

    const [finalText, citations] = await Promise.all([result.text, result.citations]);
    sendEvent({ type: "citations", value: citations });

    // Persist before ending the stream, so a client that has finished
    // reading the response can already rely on the message being saved
    // (e.g. a GET /conversations/:id right after the stream closes).
    await app.db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: finalText,
      citations,
    });

    reply.raw.end();
  });
};

export default chatRoutes;
