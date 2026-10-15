#!/usr/bin/env bash
# Pulls the embedding model and the LLM used for generation into the
# Ollama container (DOCS.md §11 lists them as EMBEDDING_MODEL / LLM_MODEL).
set -euo pipefail

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

EMBEDDING_MODEL="${EMBEDDING_MODEL:-bge-m3}"
LLM_MODEL="${LLM_MODEL:-qwen2.5:7b-instruct}"

docker compose exec ollama ollama pull "$EMBEDDING_MODEL"
docker compose exec ollama ollama pull "$LLM_MODEL"
