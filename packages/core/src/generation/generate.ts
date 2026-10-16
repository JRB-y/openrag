import { streamText } from "ai";
import type { RetrievedChunk } from "../retrieval/types.js";
import { extractCitations } from "./citations.js";
import { buildContext } from "./context.js";
import { getLanguageModel } from "./llm.js";
import { NOT_FOUND_MESSAGE, SYSTEM_PROMPT } from "./prompt.js";
import type { Citation } from "./types.js";

export interface GenerateAnswerResult {
  textStream: AsyncIterable<string>;
  text: Promise<string>;
  citations: Promise<Citation[]>;
}

function fixedResult(message: string): GenerateAnswerResult {
  return {
    textStream: (async function* () {
      yield message;
    })(),
    text: Promise.resolve(message),
    citations: Promise.resolve([]),
  };
}

// chunks is expected to already be the output of hybrid search + reranking
// (étapes 10-11) - this module only turns already-selected sources into
// an answer, it doesn't search for them.
export function generateAnswer(
  question: string,
  chunks: RetrievedChunk[],
  options?: { abortSignal?: AbortSignal },
): GenerateAnswerResult {
  if (chunks.length === 0) {
    // No chunk cleared the reranking threshold: answer directly without
    // spending an LLM call, per DOCS.md §6.3 (avoids hallucination and cost).
    return fixedResult(NOT_FOUND_MESSAGE);
  }

  const result = streamText({
    model: getLanguageModel(),
    system: SYSTEM_PROMPT,
    prompt: `${buildContext(chunks)}\n\nQuestion : ${question}`,
    abortSignal: options?.abortSignal,
  });

  const text = Promise.resolve(result.text);

  return {
    textStream: result.textStream,
    text,
    citations: text.then((resolvedText) => extractCitations(resolvedText, chunks)),
  };
}
