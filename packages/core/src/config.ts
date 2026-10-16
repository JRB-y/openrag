import { z } from "zod";

// Schéma des variables d'environnement attendues (voir DOCS.md §11).
// Le parsing est fait au chargement du module : toute variable manquante
// ou invalide fait planter l'application dès le démarrage, plutôt que de
// provoquer un bug silencieux plus tard (ex. embedding avec la mauvaise dimension).
const envSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),

  OLLAMA_BASE_URL: z.url(),
  EMBEDDING_MODEL: z.string().min(1),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive(),
  LLM_PROVIDER: z.enum(["ollama", "openai", "anthropic", "mistral"]),
  LLM_MODEL: z.string().min(1),
  RERANKER_MODEL: z.string().min(1),

  RETRIEVAL_TOP_K: z.coerce.number().int().positive(),
  RERANK_TOP_N: z.coerce.number().int().positive(),
  RERANK_MIN_SCORE: z.coerce.number().min(0).max(1),
  // z.coerce.boolean() would treat the string "false" as true (any
  // non-empty string is truthy), hence the explicit enum.
  RERANK_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  CHUNK_SIZE_TOKENS: z.coerce.number().int().positive(),
  CHUNK_OVERLAP_TOKENS: z.coerce.number().int().nonnegative(),
  MAX_UPLOAD_MB: z.coerce.number().int().positive(),
  STORAGE_DIR: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment variables, see errors above.");
}

export const env = parsed.data;
