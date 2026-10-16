import type { DocumentSourceType } from "../api-types.js";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string | null;
  sourceType: DocumentSourceType;
  sourceUri: string;
  content: string;
  headingPath: string | null;
  page: number | null;
  tokenCount: number | null;
}
