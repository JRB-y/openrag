"use client";

import type { DocumentDetailDTO } from "@openrag/core";
import { useEffect, useState } from "react";
import { getDocument } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export function ChunksDialog({
  documentId,
  onOpenChange,
}: {
  documentId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [doc, setDoc] = useState<DocumentDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setDoc(null);
      setError(null);
      return;
    }

    getDocument(documentId)
      .then(setDoc)
      .catch((err) => setError(err instanceof Error ? err.message : "Échec du chargement"));
  }, [documentId]);

  const isLoading = documentId !== null && doc === null && error === null;

  return (
    <Dialog open={documentId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{doc?.title ?? "Chunks du document"}</DialogTitle>
          <DialogDescription>
            {doc ? `${doc.chunks.length} chunk${doc.chunks.length > 1 ? "s" : ""}` : "Chargement…"}
            {doc && doc.chunkCount !== null && doc.chunks.length < doc.chunkCount
              ? ` (sur ${doc.chunkCount} au total, affichage limité)`
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex-1 overflow-y-auto px-6">
          {isLoading ? <p className="text-sm text-muted-foreground">Chargement des chunks…</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          {doc && doc.chunks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun chunk pour ce document. Il n&apos;a peut-être pas encore été indexé.
            </p>
          ) : null}

          <ul className="flex flex-col gap-3 py-1">
            {doc?.chunks.map((chunk) => (
              <li key={chunk.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="font-normal">
                    #{chunk.chunkIndex}
                  </Badge>
                  {chunk.headingPath ? <span className="truncate">{chunk.headingPath}</span> : null}
                  {chunk.page !== null ? (
                    <Badge variant="outline" className="font-normal">
                      page {chunk.page}
                    </Badge>
                  ) : null}
                  {chunk.tokenCount !== null ? <span>{chunk.tokenCount} tokens</span> : null}
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">{chunk.content}</p>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
