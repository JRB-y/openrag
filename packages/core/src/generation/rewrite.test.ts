import { describe, expect, it } from "vitest";
import { rewriteQuestion } from "./rewrite.js";

describe("rewriteQuestion", () => {
  it("returns the question unchanged when there is no history (no LLM call)", async () => {
    const start = performance.now();
    const result = await rewriteQuestion([], "Quelle est la capitale de la France ?");
    const durationMs = performance.now() - start;

    expect(result).toBe("Quelle est la capitale de la France ?");
    expect(durationMs).toBeLessThan(50);
  });

  // Integration test against the real local LLM - DOCS.md §6.1's own
  // example ("Et pour les mineurs ?" -> a standalone question).
  it(
    "rewrites a follow-up question into a standalone one, using the history",
    async () => {
      const history = [
        { role: "user" as const, content: "Quelles sont les conditions de remboursement ?" },
        {
          role: "assistant" as const,
          content: "Le remboursement est possible sous 30 jours avec le ticket de caisse.",
        },
      ];

      const result = await rewriteQuestion(history, "Et pour les mineurs ?");

      expect(result.toLowerCase()).toContain("mineur");
      expect(result.toLowerCase()).toMatch(/rembours/);
    },
    30_000,
  );
});
