"use client";

import type { DocumentDTO } from "@openrag/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { addUrlDocument, deleteDocument, listDocuments, reindexDocument, uploadDocuments } from "@/lib/api";
import { DocumentsTable } from "@/components/documents-table";
import { UploadZone } from "@/components/upload-zone";
import { UrlForm } from "@/components/url-form";

const POLL_INTERVAL_MS = 2000;

export default function Home() {
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDocuments(await listDocuments());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les documents");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while anything is still pending/processing, so statuses update
  // without the user having to refresh the page.
  useEffect(() => {
    const hasActiveDocument = documents.some(
      (doc) => doc.status === "pending" || doc.status === "processing",
    );

    if (hasActiveDocument && !pollRef.current) {
      pollRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    } else if (!hasActiveDocument && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [documents, refresh]);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    try {
      await uploadDocuments(files);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'upload");
    }
  }

  async function handleUrl(url: string) {
    setError(null);
    try {
      await addUrlDocument(url);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ajout de l'URL");
    }
  }

  async function handleReindex(id: string) {
    setError(null);
    try {
      await reindexDocument(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la ré-indexation");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteDocument(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="text-xl font-medium">OpenRag</h1>

      {error ? (
        <div className="flex items-center justify-between rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-300">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            ✕
          </button>
        </div>
      ) : null}

      <UploadZone onFiles={handleFiles} />
      <UrlForm onSubmit={handleUrl} />

      <DocumentsTable documents={documents} onReindex={handleReindex} onDelete={handleDelete} />
    </main>
  );
}
