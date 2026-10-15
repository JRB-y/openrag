import { countTokens as gptCountTokens } from "gpt-tokenizer";

// Approximation is fine here (DOCS.md §7): we don't need the exact
// tokenizer of whatever embedding/LLM model ends up running, just a
// consistent way to size chunks relative to CHUNK_SIZE_TOKENS.
export function countTokens(text: string): number {
  return gptCountTokens(text);
}
