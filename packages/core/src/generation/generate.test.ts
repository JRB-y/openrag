import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "../retrieval/types.js";
import { generateAnswer } from "./generate.js";
import { NOT_FOUND_MESSAGE } from "./prompt.js";

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = "";
  for await (const part of stream) text += part;
  return text;
}

describe("generateAnswer", () => {
  it("answers with the fixed not-found message and no citations, without calling the LLM, when there are no chunks", async () => {
    const start = performance.now();
    const result = generateAnswer("Quelle est la couleur du ciel ?", []);
    const text = await collect(result.textStream);
    const durationMs = performance.now() - start;

    expect(text).toBe(NOT_FOUND_MESSAGE);
    expect(await result.citations).toEqual([]);
    expect(durationMs).toBeLessThan(200); // no network round-trip happened
  });

  // Integration test against the real local LLM (DOCS.md §9's
  // "une question couverte par les docs donne une réponse avec
  // citations valides"). The system prompt's worked example is what
  // makes this reliable - see prompt.ts.
  it(
    "cites the source it used when the answer is covered by the context",
    async () => {
      const chunks: RetrievedChunk[] = [
        {
          chunkId: "c1",
          documentId: "d1",
          documentTitle: "Guide RH",
          sourceType: "file",
          sourceUri: "/guide-rh.pdf",
          content: "Les congés payés sont de 5 semaines par an.",
          headingPath: "Congés",
          page: 12,
          tokenCount: 10,
        },
      ];

      const result = generateAnswer("Combien de semaines de congés payés a-t-on par an ?", chunks);
      const text = await collect(result.textStream);
      const citations = await result.citations;

      expect(text).toContain("[1]");
      expect(citations).toEqual([
        expect.objectContaining({ n: 1, chunkId: "c1", documentId: "d1", page: 12 }),
      ]);
    },
    30_000,
  );
});
