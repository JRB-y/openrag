import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../security/safe-url.js", () => ({
  assertPublicHttpUrl: vi.fn((rawUrl: string) => Promise.resolve(new URL(rawUrl))),
}));

const fixturesDir = path.join(import.meta.dirname, "fixtures");

function fakeResponse(body: Buffer, contentType: string): Response {
  return new Response(new Uint8Array(body), { status: 200, headers: { "content-type": contentType } });
}

describe("parseUrl", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("delegates to the HTML parser for text/html responses", async () => {
    const html = await readFile(path.join(fixturesDir, "sample.html"));
    globalThis.fetch = vi.fn(() => Promise.resolve(fakeResponse(html, "text/html; charset=utf-8")));

    const { parseUrl } = await import("./url.js");
    const result = await parseUrl("https://example.com/guide");

    expect(result.title).toBe("Guide RH - Congés payés");
    expect(result.markdown).toContain("| Congés payés | 5 semaines |");
  });

  it("delegates to the PDF parser for application/pdf responses", async () => {
    const pdf = await readFile(path.join(fixturesDir, "sample.pdf"));
    globalThis.fetch = vi.fn(() => Promise.resolve(fakeResponse(pdf, "application/pdf")));

    const { parseUrl } = await import("./url.js");
    const result = await parseUrl("https://example.com/guide.pdf");

    expect(result.title).toBe("Politique RH");
    expect(result.pages).toHaveLength(2);
  });

  it("throws when the response is not ok", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 404 })));

    const { parseUrl } = await import("./url.js");
    await expect(parseUrl("https://example.com/missing")).rejects.toThrow(/404/);
  });
});
