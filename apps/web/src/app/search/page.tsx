"use client";

import type { RetrievedChunk } from "@openrag/core";
import { useState } from "react";
import { searchChunks } from "@/lib/api";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RetrievedChunk[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    try {
      setResults(await searchChunks(query.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la recherche");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <AppHeader />

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Poser une question ou chercher un mot-clé…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={isSearching || !query.trim()}>
          {isSearching ? "Recherche…" : "Rechercher"}
        </Button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {results !== null && !error ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {results.length} résultat{results.length > 1 ? "s" : ""}
          </p>

          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun résultat. Essayez une autre formulation.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((r, i) => (
                <li key={r.chunkId} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal">
                      #{i + 1}
                    </Badge>
                    <span className="truncate font-medium text-foreground">
                      {r.documentTitle ?? "Sans titre"}
                    </span>
                    {r.headingPath ? <span className="truncate">{r.headingPath}</span> : null}
                    {r.page !== null ? (
                      <Badge variant="outline" className="font-normal">
                        page {r.page}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{r.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </main>
  );
}
