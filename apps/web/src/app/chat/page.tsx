"use client";

import type { Citation, ConversationDTO, DocumentDTO } from "@openrag/core";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listConversations, listDocuments } from "@/lib/api";
import { useChat } from "@/hooks/use-chat";
import { AppHeader } from "@/components/app-header";
import { ChatMessage } from "@/components/chat-message";
import { ChatSidebar } from "@/components/chat-sidebar";
import { CitationDialog } from "@/components/citation-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ChatPage() {
  const [documents, setDocuments] = useState<DocumentDTO[] | null>(null);
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [input, setInput] = useState("");
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { conversationId, messages, isStreaming, error, sendMessage, stop, loadConversation, startNewConversation } =
    useChat(null);

  useEffect(() => {
    listDocuments().then(setDocuments);
    listConversations().then(setConversations);
  }, []);

  // A new conversation only gets its id once the server creates it - at
  // that point the sidebar needs refreshing to show it (with its title).
  useEffect(() => {
    if (conversationId && !conversations.some((c) => c.id === conversationId)) {
      listConversations().then(setConversations);
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const documentTitles = new Map(documents?.map((d) => [d.id, d.title]) ?? []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  }

  if (documents !== null && documents.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
        <AppHeader />
        <p className="py-20 text-center text-sm text-muted-foreground">
          Aucun document indexé, commencez par en ajouter sur la page{" "}
          <Link href="/" className="underline">
            Documents
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-screen max-w-5xl flex-col gap-4 px-6 py-6">
      <AppHeader />

      <div className="flex flex-1 gap-4 overflow-hidden">
        <ChatSidebar
          conversations={conversations}
          activeConversationId={conversationId}
          onSelect={loadConversation}
          onNew={startNewConversation}
        />

        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3 pb-2">
              {messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Posez une question sur vos documents.
                </p>
              ) : null}

              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  citations={m.citations}
                  onCitationClick={setSelectedCitation}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Votre question…"
              className="min-h-[44px] flex-1 resize-none"
              rows={1}
            />
            {isStreaming ? (
              <Button type="button" variant="outline" onClick={stop}>
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()}>
                Envoyer
              </Button>
            )}
          </form>
        </div>
      </div>

      <CitationDialog
        citation={selectedCitation}
        documentTitle={selectedCitation ? (documentTitles.get(selectedCitation.documentId) ?? null) : null}
        onOpenChange={(open) => !open && setSelectedCitation(null)}
      />
    </main>
  );
}
