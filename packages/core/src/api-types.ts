// Shared between apps/api (response shape) and apps/web (API client),
// so the front doesn't redefine its own copy of what the API returns.
export type DocumentStatus = "pending" | "processing" | "ready" | "failed";
export type DocumentSourceType = "file" | "url";

export interface DocumentDTO {
  id: string;
  sourceType: DocumentSourceType;
  sourceUri: string;
  title: string | null;
  mimeType: string | null;
  contentHash: string | null;
  status: DocumentStatus;
  error: string | null;
  chunkCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkSummaryDTO {
  id: string;
  chunkIndex: number;
  content: string;
  headingPath: string | null;
  page: number | null;
  tokenCount: number | null;
  createdAt: string;
}

export interface DocumentDetailDTO extends DocumentDTO {
  chunks: ChunkSummaryDTO[];
}
