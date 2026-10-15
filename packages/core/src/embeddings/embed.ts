import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { embedMany } from "ai";
import { env } from "../config.js";

// Ollama exposes an OpenAI-compatible endpoint, so the AI SDK can talk
// to it through the generic "openai-compatible" provider instead of a
// dedicated (and less actively maintained) community package.
const provider = createOpenAICompatible({
  name: "ollama",
  baseURL: `${env.OLLAMA_BASE_URL}/v1`,
});

const model = provider.embeddingModel(env.EMBEDDING_MODEL);

const BATCH_SIZE = 32;

function toBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (const batch of toBatches(texts, BATCH_SIZE)) {
    // maxRetries: AI SDK's built-in retry with backoff on network errors.
    const { embeddings } = await embedMany({ model, values: batch, maxRetries: 3 });

    for (const embedding of embeddings) {
      if (embedding.length !== env.EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding model "${env.EMBEDDING_MODEL}" returned ${embedding.length} dimensions, expected ${env.EMBEDDING_DIMENSIONS}`,
        );
      }
      results.push(embedding);
    }
  }

  return results;
}
