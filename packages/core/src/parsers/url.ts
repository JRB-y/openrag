import { env } from "../config.js";
import { assertPublicHttpUrl } from "../security/safe-url.js";
import { parseHtml } from "./html.js";
import { isMediaWikiHost, preprocessMediaWikiHtml } from "./mediawiki.js";
import { parsePdf } from "./pdf.js";
import type { ParseResult } from "./types.js";

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "OpenRag/1.0 (+https://github.com/JRB-y/openrag)";

async function readLimited(res: Response, maxBytes: number): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) {
    return Buffer.from(await res.arrayBuffer());
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response exceeds the ${maxBytes} byte limit`);
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

// Re-validates the URL at fetch time (not just at submission time, see
// POST /documents/url) to close the DNS-rebinding window between the
// two checks.
export async function parseUrl(rawUrl: string): Promise<ParseResult> {
  const url = await assertPublicHttpUrl(rawUrl);

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url.toString()}: HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const buffer = await readLimited(res, env.MAX_UPLOAD_MB * 1024 * 1024);
  const filename = url.pathname.split("/").pop() || url.hostname;

  if (contentType.includes("application/pdf")) {
    return parsePdf(buffer, filename);
  }

  if (isMediaWikiHost(url.hostname)) {
    return parseHtml(Buffer.from(preprocessMediaWikiHtml(buffer.toString("utf-8"))), filename);
  }

  return parseHtml(buffer, filename);
}
