export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  page: number | null;
  excerpt: string;
}
