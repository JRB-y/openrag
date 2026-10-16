import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "../config.js";

// openai/anthropic/mistral read their API key from the standard env var
// each AI SDK package already expects (OPENAI_API_KEY, etc.) - no need
// to add them to our own Zod schema, since only the ollama path (no
// key required) is meant to be exercised/tested in this project.
export function getLanguageModel() {
  switch (env.LLM_PROVIDER) {
    case "ollama": {
      const provider = createOpenAICompatible({
        name: "ollama",
        baseURL: `${env.OLLAMA_BASE_URL}/v1`,
      });
      return provider.languageModel(env.LLM_MODEL);
    }
    case "openai":
      return createOpenAI().languageModel(env.LLM_MODEL);
    case "anthropic":
      return createAnthropic().languageModel(env.LLM_MODEL);
    case "mistral":
      return createMistral().languageModel(env.LLM_MODEL);
  }
}
