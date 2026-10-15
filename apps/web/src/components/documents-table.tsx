"use client";

import type { DocumentDTO } from "@openrag/core";
import { FileText, Globe, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentsTable({
  documents,
  onReindex,
  onDelete,
}: {
  documents: DocumentDTO[];
  onReindex: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<DocumentDTO | null>(null);

  if (documents.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aucun document pour l&apos;instant. Ajoutez-en un ci-dessus.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-2 font-normal">Titre</th>
              <th className="px-4 py-2 font-normal">Type</th>
              <th className="px-4 py-2 font-normal">Statut</th>
              <th className="px-4 py-2 font-normal">Chunks</th>
              <th className="px-4 py-2 font-normal">Créé</th>
              <th className="px-4 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-border last:border-0">
                <td className="max-w-xs truncate px-4 py-3">
                  {doc.title ?? <span className="text-muted-foreground">Sans titre</span>}
                  {doc.status === "failed" && doc.error ? (
                    <p className="mt-1 truncate text-xs text-red-400" title={doc.error}>
                      {doc.error}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {doc.sourceType === "file" ? (
                    <FileText className="size-4" aria-label="Fichier" />
                  ) : (
                    <Globe className="size-4" aria-label="URL" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{doc.chunkCount ?? 0}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Ré-indexer"
                      onClick={() => onReindex(doc.id)}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Supprimer"
                      onClick={() => setPendingDelete(doc)}
                    >
                      <Trash2 className="size-4 text-red-400" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce document ?</DialogTitle>
            <DialogDescription>
              « {pendingDelete?.title ?? "Sans titre"} » et tous ses chunks seront définitivement
              supprimés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
