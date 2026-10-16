"use client";

import type { Citation } from "@openrag/core";
import { useCallback, useRef, useState } from "react";
import { API_URL, getConversation } from "@/lib/api";

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
}

// POST /chat streams a hand-rolled SSE protocol (not the AI SDK's own
// data-stream format - see apps/api/src/routes/chat.ts), so we read and
// parse it ourselves instead of using the AI SDK's useChat hook. Each
// event is one line "data: {...}"; events are separated by a blank line.
type ChatEvent =
  | { type: "conversationId"; value: string }
  | { type: "text"; value: string }
  | { type: "citations"; value: Citation[] };

export function useChat(initialConversationId: string | null) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversation = useCallback(async (id: string) => {
    setError(null);
    const conversation = await getConversation(id);
    setConversationId(conversation.id);
    setMessages(
      conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations,
      })),
    );
  }, []);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  function stop() {
    abortRef.current?.abort();
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;

    setError(null);
    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      citations: null,
    };
    const assistantMessageId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantMessageId, role: "assistant", content: "", citations: null },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The API's conversationId field is optional (absent key), not
        // nullable - omit it entirely for a new conversation rather
        // than sending `null`.
        body: JSON.stringify(conversationId ? { conversationId, message: text } : { message: text }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;

          const event = JSON.parse(line.slice("data: ".length)) as ChatEvent;

          if (event.type === "conversationId") {
            setConversationId(event.value);
          } else if (event.type === "text") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: m.content + event.value } : m,
              ),
            );
          } else if (event.type === "citations") {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMessageId ? { ...m, citations: event.value } : m)),
            );
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Échec de la génération");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  return { conversationId, messages, isStreaming, error, sendMessage, stop, loadConversation, startNewConversation };
}
