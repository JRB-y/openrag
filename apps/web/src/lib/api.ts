import type { DocumentDetailDTO, DocumentDTO } from "@openrag/core";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function listDocuments(): Promise<DocumentDTO[]> {
  return request<DocumentDTO[]>("/documents");
}

export function getDocument(id: string, options?: { limit?: number }): Promise<DocumentDetailDTO> {
  const limit = options?.limit ?? 200; // server max; no pagination UI yet
  return request<DocumentDetailDTO>(`/documents/${id}?limit=${limit}`);
}

export function uploadDocuments(files: File[]) {
  const form = new FormData();
  for (const file of files) {
    form.append("file", file);
  }

  return request<{ documents: { id: string; title: string | null }[] }>("/documents/upload", {
    method: "POST",
    body: form,
  });
}

export function addUrlDocument(url: string): Promise<{ id: string }> {
  return request<{ id: string }>("/documents/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export function deleteDocument(id: string): Promise<void> {
  return request<void>(`/documents/${id}`, { method: "DELETE" });
}

export function reindexDocument(id: string): Promise<DocumentDTO> {
  return request<DocumentDTO>(`/documents/${id}/reindex`, { method: "POST" });
}
