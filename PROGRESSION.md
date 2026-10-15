# OpenRag — Progression

> Checklist de développement, étape par étape. À cocher au fur et à mesure (`- [x]`).
> Chaque étape se termine par un **critère de validation** : on ne passe à la suivante que quand il est rempli.
> Référence fonctionnelle et technique : [DOCS.md](./DOCS.md).

**Légende** : 🟢 facile · 🟡 moyen · 🔴 délicat

---

## Étape 0 — Initialisation du monorepo 🟢

- [x] Créer le repo `openrag` + `.gitignore` (node_modules, .env, storage/, dist/, .next/)
- [x] `pnpm init` à la racine + `pnpm-workspace.yaml` (`apps/*`, `packages/*`)
- [x] Fixer la version de Node (`.nvmrc` → 22, champ `engines` dans `package.json`)
- [x] `tsconfig.base.json` partagé (strict, `moduleResolution: bundler`, `target: ES2022`)
- [x] Créer les dossiers : `apps/api`, `apps/worker`, `apps/web`, `packages/core`
- [x] Configurer ESLint + Prettier à la racine
- [x] Installer Vitest à la racine
- [x] Scripts racine : `dev`, `build`, `lint`, `test`, `typecheck`
- [x] Créer `.env.example` (variables listées dans DOCS.md §11)
- [x] Charger et valider l'env avec Zod dans `packages/core/src/config.ts` (l'app plante au démarrage si une variable manque)

**✅ Validation** : `pnpm install && pnpm typecheck && pnpm lint` passent sans erreur. ✅

---

## Étape 1 — Infrastructure locale 🟢

- [ ] `docker-compose.yml` avec :
  - [ ] `postgres` (image `pgvector/pgvector:pg16`), volume persistant, healthcheck
  - [ ] `redis` (image `redis:7`), healthcheck
  - [ ] `ollama` (image `ollama/ollama`), volume pour les modèles
- [ ] Script `pnpm infra:up` / `pnpm infra:down`
- [ ] Script `pnpm models:pull` (télécharge `bge-m3` et le LLM choisi dans Ollama)
- [ ] Vérifier qu'Ollama répond : `curl localhost:11434/api/tags`

**✅ Validation** : `docker compose up -d` démarre les 3 services en état `healthy` ; un appel d'embedding via `curl` à Ollama renvoie un vecteur de 1024 dimensions.

---

## Étape 2 — Base de données (packages/core/db) 🟡

- [ ] Installer `drizzle-orm`, `drizzle-kit`, `postgres` (driver)
- [ ] `drizzle.config.ts`
- [ ] Migration 0 : `CREATE EXTENSION vector` (migration SQL manuelle)
- [ ] Schéma Drizzle des tables `documents`, `chunks`, `conversations`, `messages` (DOCS.md §7)
  - [ ] Type `vector(1024)` pour `chunks.embedding`
  - [ ] Colonne générée `tsv` (SQL brut si Drizzle ne la gère pas)
- [ ] Index : HNSW sur `embedding`, GIN sur `tsv`, B-tree sur `document_id`
- [ ] Générer et appliquer les migrations (`pnpm db:generate`, `pnpm db:migrate`)
- [ ] Exporter un client DB unique depuis `packages/core`
- [ ] Script `pnpm db:reset` (drop + migrate) pour le dev

**✅ Validation** : test Vitest qui insère un document + un chunk avec un vecteur aléatoire, puis le relit par similarité cosinus.

---

## Étape 3 — API minimale (apps/api) 🟢

- [ ] Installer `fastify`, `@fastify/cors`, `@fastify/multipart`, `fastify-type-provider-zod`
- [ ] `server.ts` : création du serveur, logger Pino, fermeture propre (SIGTERM)
- [ ] Plugin `db` (décore `fastify.db`)
- [ ] Gestionnaire d'erreurs global (format JSON uniforme `{ error, message }`)
- [ ] Route `GET /health` : vérifie Postgres, Redis et Ollama
- [ ] Script `dev` avec `tsx watch`

**✅ Validation** : `GET /health` renvoie `200` avec l'état de chaque service, et `503` si l'un d'eux est arrêté.

---

## Étape 4 — File de jobs (BullMQ) 🟢

- [ ] Installer `bullmq` + `ioredis`
- [ ] Définir la queue `ingestion` et le type du payload `{ documentId }` dans `packages/core`
- [ ] Plugin `queue` dans l'API
- [ ] `apps/worker/src/index.ts` : worker BullMQ, concurrence configurable, logs Pino
- [ ] Options de job : 3 tentatives, backoff exponentiel, suppression des jobs terminés après N jours
- [ ] Job factice qui logue le `documentId`

**✅ Validation** : un job ajouté depuis l'API est consommé et logué par le worker ; un job qui lève une erreur est retenté 3 fois.

---

## Étape 5 — Réception des documents 🟡

### Upload de fichiers
- [ ] Route `POST /documents/upload` (multipart, plusieurs fichiers)
- [ ] Limite de taille (`MAX_UPLOAD_MB`)
- [ ] Détection du vrai type avec `file-type` (+ fallback extension pour MD/TXT)
- [ ] Refus des types non supportés (`415`)
- [ ] Stockage dans `STORAGE_DIR/<documentId>/<nom-original>` derrière une interface `Storage` (pour passer à S3 plus tard)
- [ ] Création du document (`status = pending`) + ajout du job

### Ajout d'URL
- [ ] Route `POST /documents/url` (body validé par Zod)
- [ ] Protection SSRF : http/https uniquement, résolution DNS, refus des IP privées / loopback / link-local
- [ ] Création du document + ajout du job

### Gestion
- [ ] `GET /documents` (liste + statut + nombre de chunks)
- [ ] `GET /documents/:id` (détail + chunks paginés)
- [ ] `DELETE /documents/:id` (supprime fichier + document ; chunks en cascade)
- [ ] `POST /documents/:id/reindex` (remet `pending` + nouveau job)

**✅Validation** : uploader un PDF et ajouter une URL créent 2 documents `pending` et 2 jobs ; une URL `http://127.0.0.1` est refusée ; un `.exe` renommé en `.pdf` est refusé.

---

## Étape 6 — Parsers (packages/core/parsers) 🟡

Interface commune : `parse(input) → { title, markdown, pages?: { page, startOffset }[] }`

- [ ] `markdown.ts` / `txt.ts` : lecture directe
- [ ] `pdf.ts` avec `unpdf` : extraction page par page, conservation du numéro de page
- [ ] `docx.ts` : `mammoth` → HTML → `turndown` → Markdown
- [ ] `html.ts` : `jsdom` + `@mozilla/readability` → `turndown`
- [ ] `url.ts` : fetch (timeout, limite de taille, user-agent), puis délégation à `html.ts` ou `pdf.ts` selon le `content-type`
- [ ] Règle `turndown` pour conserver les tableaux (plugin GFM)
- [ ] Extraction du titre (métadonnées PDF, `<title>`, premier H1, sinon nom du fichier)
- [ ] Dossier `fixtures/` avec un exemple par format (dont un PDF avec tableau)
- [ ] Tests Vitest pour chaque parser

**✅ Validation** : chaque fixture produit un Markdown lisible ; les titres et tableaux sont conservés ; les pages PDF sont correctement repérées.

---

## Étape 7 — Chunking structurel (packages/core/chunking) 🔴

- [ ] Compteur de tokens (`gpt-tokenizer` ou `js-tiktoken`, approximation suffisante)
- [ ] Parser le Markdown en AST avec `remark` (`unified` + `remark-parse` + `remark-gfm`)
- [ ] Découper par sections (H1 > H2 > H3) en suivant le fil d'Ariane des titres
- [ ] Sous-découper les sections trop longues par paragraphes, avec chevauchement (`CHUNK_OVERLAP_TOKENS`)
- [ ] Ne jamais couper un tableau ou un bloc de code (s'il dépasse la taille, il forme un chunk à lui seul)
- [ ] Fusionner les sections trop courtes avec la suivante (éviter les chunks de 10 tokens)
- [ ] Associer chaque chunk à sa page (PDF) grâce aux offsets
- [ ] Sortie : `{ index, content, headingPath, page, tokenCount }[]`
- [ ] Tests : taille max respectée, tableaux intacts, fil d'Ariane correct, ordre conservé

**✅ Validation** : sur les fixtures, aucun chunk ne dépasse la taille cible (sauf tableau/code isolé), et chaque chunk a un `headingPath` cohérent.

---

## Étape 8 — Embeddings (packages/core/embeddings) 🟢

- [ ] Installer `ai` (Vercel AI SDK) + un provider Ollama compatible
- [ ] Interface `embed(texts: string[]) → number[][]`
- [ ] Traitement par lots de 32
- [ ] Texte embeddé = `headingPath + "\n\n" + content` (contextualisation)
- [ ] Vérifier la dimension renvoyée (= `EMBEDDING_DIMENSIONS`), sinon erreur explicite
- [ ] Retry sur erreur réseau

**✅ Validation** : deux phrases de sens proche ont une similarité cosinus nettement supérieure à deux phrases sans rapport.

---

## Étape 9 — Job d'ingestion complet (apps/worker) 🔴

- [ ] Passer le document en `processing`
- [ ] Charger la source (fichier ou URL) → parser
- [ ] Calculer le hash SHA-256 du Markdown
  - [ ] Ré-indexation avec hash identique → repasser en `ready` sans rien refaire
  - [ ] Nouveau document dont le hash existe déjà → marquer comme doublon (`failed` + message, ou lien vers l'original)
- [ ] Chunker → embedder
- [ ] **Transaction** : supprimer les anciens chunks → insérer les nouveaux → mettre à jour `content_hash`, `chunk_count`, `title`, `status = ready`
- [ ] En cas d'erreur définitive : `status = failed` + message dans `error`
- [ ] Logs structurés avec la durée de chaque étape

**✅ Validation** : uploader un PDF de 20 pages → le document passe à `ready` avec ses chunks en base ; arrêter Ollama pendant l'ingestion → retries puis `failed` avec un message clair ; relancer → `ready`.

---

## Étape 10 — Recherche hybride (packages/core/retrieval) 🔴

- [ ] Recherche vectorielle : `ORDER BY embedding <=> $query LIMIT RETRIEVAL_TOP_K`
- [ ] Recherche plein texte : `websearch_to_tsquery('simple', $q)` + `ts_rank_cd`, `LIMIT RETRIEVAL_TOP_K`
- [ ] Exécuter les deux en parallèle (ou en une seule requête SQL avec deux CTE)
- [ ] Fusion **RRF** (`k = 60`) + dédoublonnage
- [ ] Retourner les chunks avec les métadonnées du document (titre, source, page)
- [ ] Tests : une question avec un code exact (ex. une référence) est trouvée grâce au plein texte ; une question paraphrasée est trouvée grâce aux vecteurs

**✅ Validation** : sur un document de test, les deux types de questions remontent le bon chunk dans le top 5.

---

## Étape 11 — Reranking 🟡

- [ ] Installer `@huggingface/transformers`
- [ ] Charger `bge-reranker-base` (ONNX) **une seule fois** au démarrage (singleton)
- [ ] Scorer chaque paire (question, chunk) → trier → garder `RERANK_TOP_N`
- [ ] Appliquer le seuil `RERANK_MIN_SCORE` (renvoyer une liste vide si rien ne passe)
- [ ] Mesurer la latence (objectif < 1 s pour 30 candidats sur CPU)
- [ ] Prévoir un flag pour désactiver le reranking (utile pour les évals de la phase 2)

**✅ Validation** : sur 10 questions test, le bon chunk remonte plus souvent en 1ʳᵉ position avec reranking que sans.

---

## Étape 12 — Génération et citations (packages/core/generation) 🔴

- [ ] Provider LLM configurable via l'AI SDK (`LLM_PROVIDER`, `LLM_MODEL`)
- [ ] **Réécriture de la question** si historique : prompt dédié, sortie = question autonome
- [ ] Construction du contexte numéroté `[n] (titre, page, headingPath)\ncontenu`
- [ ] Prompt système (DOCS.md §6.4) : sources uniquement, citations `[n]`, « je ne sais pas » sinon, langue de la question
- [ ] Si aucun chunk après reranking → réponse fixe « Je n'ai pas trouvé cette information dans les documents », **sans appel au LLM**
- [ ] Génération en streaming (`streamText`)
- [ ] Post-traitement : extraire les `[n]` utilisés → construire `citations` (`chunkId`, `documentId`, `page`, extrait)
- [ ] Ignorer les `[n]` qui ne correspondent à aucune source fournie

**✅ Validation** : une question couverte par les docs donne une réponse avec citations valides ; une question hors sujet donne la réponse « non trouvé ».

---

## Étape 13 — API de chat 🟡

- [ ] `POST /chat` : `{ conversationId?, message }`
  - [ ] Créer la conversation si absente (titre = début de la première question)
  - [ ] Enregistrer le message utilisateur
  - [ ] Charger les N derniers messages pour la réécriture
  - [ ] Pipeline : réécriture → recherche → rerank → génération streamée
  - [ ] Envoyer les citations au client (data part de l'AI SDK ou événement SSE final)
  - [ ] Enregistrer la réponse + citations à la fin du stream
  - [ ] Gérer l'annulation (client qui ferme la connexion)
- [ ] `GET /conversations`
- [ ] `GET /conversations/:id`
- [ ] `DELETE /conversations/:id`

**✅ Validation** : un échange en plusieurs tours fonctionne (« Et pour les mineurs ? » est bien compris) ; l'historique est relu correctement.

---

## Étape 14 — Front (apps/web) 🟡

### Setup
- [ ] Next.js (App Router) + Tailwind + shadcn/ui
- [ ] Client API typé (types partagés depuis `packages/core`)

### Page Documents
- [ ] Zone de drag & drop multi-fichiers
- [ ] Champ d'ajout d'URL
- [ ] Liste des documents : titre, type, statut (badge), nombre de chunks, date
- [ ] Rafraîchissement auto des statuts tant qu'un document est `pending`/`processing` (polling)
- [ ] Actions : ré-indexer, supprimer (avec confirmation)
- [ ] Affichage du message d'erreur pour les documents `failed`

### Page Chat
- [ ] Sidebar : liste des conversations + « Nouvelle conversation »
- [ ] Chat avec `useChat` (AI SDK), réponse en streaming
- [ ] Rendu Markdown des réponses (`react-markdown`)
- [ ] Citations `[n]` cliquables → panneau avec titre, page, extrait du chunk
- [ ] État vide (« Aucun document indexé, commencez par en ajouter »)
- [ ] Bouton stop pendant la génération

**✅ Validation** : parcours complet sans toucher au terminal : uploader un PDF → attendre `ready` → poser une question → cliquer sur une citation → voir l'extrait.

---

## Étape 15 — Finitions phase 1 🟢

- [ ] Tests d'intégration : ingestion bout en bout + chat (Postgres/Redis de test via Docker)
- [ ] GitHub Actions : lint + typecheck + tests sur chaque PR
- [ ] `README.md` : présentation, schéma d'architecture, démarrage rapide, captures d'écran
- [ ] Jeu de documents de démo (`demo/`) + script `pnpm demo:seed`
- [ ] Vidéo de démo de 2 minutes
- [ ] Tag `v0.1.0`

**✅ Validation** : un dev qui clone le repo a l'application qui tourne en moins de 10 minutes en suivant le README.

---

## Suite (à détailler plus tard)

- [ ] **Phase 2 — Évaluations** : jeu de 50–100 questions, recall@5, fidélité, pertinence, comparaisons chiffrées, CI bloquante
- [ ] **Phase 3 — Multi-utilisateurs** : Better Auth, `tenant_id` + Row Level Security, test d'isolation, quotas
- [ ] **Phase 4 — Connecteurs** : crawl par sitemap, Notion, Confluence, sync incrémentale planifiée
- [ ] **Phase 5 — Production** : Langfuse, S3/MinIO, cache sémantique, déploiement

---

## Journal

| Date | Étape | Notes |
|---|---|---|
| 2026-10-15 | 0 | Repo git initialisé, `.gitignore` créé, remote GitHub lié. |
| 2026-10-15 | 0 | `pnpm init` + `pnpm-workspace.yaml` (apps/*, packages/*). |
| 2026-10-15 | 0 | Étape 0 terminée : Node 22 (.nvmrc/engines), tsconfig.base.json, dossiers apps/packages, ESLint+Prettier, Vitest, scripts racine, .env.example, config.ts (Zod). |