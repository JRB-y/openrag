"use client";

import type { Citation } from "@openrag/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function ChatMessage({
  role,
  content,
  citations,
  onCitationClick,
}: {
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  onCitationClick: (citation: Citation) => void;
}) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-2 text-sm",
          role === "user" ? "bg-accent text-accent-foreground" : "bg-muted text-foreground",
        )}
      >
        {role === "assistant" ? (
          <div
            className="[&_code]:rounded [&_code]:bg-background/50 [&_code]:px-1 [&_li]:ml-4 [&_li]:list-disc [&_ol]:my-2 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_ul]:my-2"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "…"}</ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{content}</p>
        )}

        {citations && citations.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-border/50 pt-2">
            {citations.map((citation) => (
              <button
                key={citation.n}
                onClick={() => onCitationClick(citation)}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                [{citation.n}]
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
