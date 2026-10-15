import {
  db,
  documents,
  parseDocx,
  parseHtml,
  parseMarkdown,
  parsePdf,
  parseTxt,
  parseUrl,
  storage,
  type ParseResult,
} from "@openrag/core";
import { eq } from "drizzle-orm";

// Minimal wiring for now: run the right parser and store its title.
// Chunking, embeddings and the full transactional write (étapes 7-9)
// come later - this only proves a document can go pending -> ready.
async function parseStoredFile(documentId: string, mimeType: string | null): Promise<ParseResult> {
  const { filename, data } = await storage.read(documentId);

  switch (mimeType) {
    case "application/pdf":
      return parsePdf(data, filename);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return parseDocx(data, filename);
    case "text/html":
      return parseHtml(data, filename);
    case "text/markdown":
      return parseMarkdown(data, filename);
    case "text/plain":
      return parseTxt(data, filename);
    default:
      throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}

export async function ingestDocument(documentId: string): Promise<void> {
  await db
    .update(documents)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }

  const result =
    doc.sourceType === "url" ? await parseUrl(doc.sourceUri) : await parseStoredFile(documentId, doc.mimeType);

  await db
    .update(documents)
    .set({ title: result.title, status: "ready", error: null, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}
