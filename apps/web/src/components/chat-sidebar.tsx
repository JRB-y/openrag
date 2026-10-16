"use client";

import type { ConversationDTO } from "@openrag/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function ChatSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onNew,
}: {
  conversations: ConversationDTO[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-2 border-r border-border pr-4">
      <Button variant="outline" size="sm" onClick={onNew} className="justify-start gap-2">
        <Plus className="size-4" />
        Nouvelle conversation
      </Button>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cn(
                "truncate rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                conversation.id === activeConversationId && "bg-accent text-accent-foreground",
              )}
              title={conversation.title ?? "Sans titre"}
            >
              {conversation.title ?? "Sans titre"}
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
