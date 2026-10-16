import type {
  ChunkSummaryDTO,
  Citation,
  ConversationDTO,
  DocumentDTO,
  MessageDTO,
  chunks,
  conversations,
  documents,
  messages,
} from "@openrag/core";

export function serializeDocument(doc: typeof documents.$inferSelect): DocumentDTO {
  return {
    ...doc,
    sourceType: doc.sourceType as DocumentDTO["sourceType"],
    status: doc.status as DocumentDTO["status"],
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

type ChunkSummary = Pick<
  typeof chunks.$inferSelect,
  "id" | "chunkIndex" | "content" | "headingPath" | "page" | "tokenCount" | "createdAt"
>;

export function serializeChunk(chunk: ChunkSummary): ChunkSummaryDTO {
  return {
    ...chunk,
    createdAt: chunk.createdAt.toISOString(),
  };
}

export function serializeConversation(conversation: typeof conversations.$inferSelect): ConversationDTO {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
  };
}

export function serializeMessage(message: typeof messages.$inferSelect): MessageDTO {
  return {
    ...message,
    role: message.role as MessageDTO["role"],
    citations: message.citations as Citation[] | null,
    createdAt: message.createdAt.toISOString(),
  };
}
