import path from "node:path";
import { fileTypeFromBuffer } from "file-type";

// Binary formats have magic bytes file-type can read from the content
// itself - this is what catches a renamed .exe.
const ACCEPTED_BINARY_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Markdown, plain text and HTML have no magic bytes, so file-type
// always returns undefined for them - we fall back to the extension.
const EXTENSION_FALLBACKS: Record<string, string> = {
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".html": "text/html",
  ".htm": "text/html",
};

export async function detectMimeType(buffer: Buffer, filename: string): Promise<string | null> {
  const detected = await fileTypeFromBuffer(buffer);
  if (detected) {
    return ACCEPTED_BINARY_MIMES.has(detected.mime) ? detected.mime : null;
  }

  return EXTENSION_FALLBACKS[path.extname(filename).toLowerCase()] ?? null;
}
