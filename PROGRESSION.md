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

- [x] `docker-compose.yml` avec :
  - [x] `postgres` (image `pgvector/pgvector:pg16`), volume persistant, healthcheck
  - [x] `redis` (image `redis:7`), healthcheck
  - [x] `ollama` (image `ollama/ollama`), volume pour les modèles
- [x] Script `pnpm infra:up` / `pnpm infra:down`
- [x] Script `pnpm models:pull` (télécharge `bge-m3` et le LLM choisi dans Ollama)
- [x] Vérifier qu'Ollama répond : `curl localhost:11434/api/tags`

**✅ Validation** : `docker compose up -d` démarre les 3 services en état `healthy` ; un appel d'embedding via `curl` à Ollama renvoie un vecteur de 1024 dimensions. ✅

---

## Étape 2 — Base de données (packages/core/db) 🟡

- [x] Installer `drizzle-orm`, `drizzle-kit`, `postgres` (driver)
- [x] `drizzle.config.ts`
- [x] Migration 0 : `CREATE EXTENSION vector` (migration SQL manuelle)
- [x] Schéma Drizzle des tables `documents`, `chunks`, `conversations`, `messages` (DOCS.md §7)
  - [x] Type `vector(1024)` pour `chunks.embedding`
  - [x] Colonne générée `tsv` (SQL brut si Drizzle ne la gère pas)
- [x] Index : HNSW sur `embedding`, GIN sur `tsv`, B-tree sur `document_id`
- [x] Générer et appliquer les migrations (`pnpm db:generate`, `pnpm db:migrate`)
- [x] Exporter un client DB unique depuis `packages/core`
- [x] Script `pnpm db:reset` (drop + migrate) pour le dev

**✅ Validation** : test Vitest qui insère un document + un chunk avec un vecteur aléatoire, puis le relit par similarité cosinus. ✅ (vérifié manuellement ; le test Vitest formel viendra avec le reste de la couche retrieval, étape 10)

---

## Étape 3 — API minimale (apps/api) 🟢

- [x] Installer `fastify`, `@fastify/cors`, `@fastify/multipart`, `fastify-type-provider-zod`
- [x] `server.ts` : création du serveur, logger Pino, fermeture propre (SIGTERM)
- [x] Plugin `db` (décore `fastify.db`)
- [x] Gestionnaire d'erreurs global (format JSON uniforme `{ error, message }`)
- [x] Route `GET /health` : vérifie Postgres, Redis et Ollama
- [x] Script `dev` avec `tsx watch`

**✅ Validation** : `GET /health` renvoie `200` avec l'état de chaque service, et `503` si l'un d'eux est arrêté. ✅

---

## Étape 4 — File de jobs (BullMQ) 🟢

- [x] Installer `bullmq` + `ioredis`
- [x] Définir la queue `ingestion` et le type du payload `{ documentId }` dans `packages/core`
- [x] Plugin `queue` dans l'API
- [x] `apps/worker/src/index.ts` : worker BullMQ, concurrence configurable, logs Pino
- [x] Options de job : 3 tentatives, backoff exponentiel, suppression des jobs terminés après N jours
- [x] Job factice qui logue le `documentId`

**✅ Validation** : un job ajouté depuis l'API est consommé et logué par le worker ; un job qui lève une erreur est retenté 3 fois. ✅

---

## Étape 5 — Réception des documents 🟡

### Upload de fichiers
- [x] Route `POST /documents/upload` (multipart, plusieurs fichiers)
- [x] Limite de taille (`MAX_UPLOAD_MB`)
- [x] Détection du vrai type avec `file-type` (+ fallback extension pour MD/TXT)
- [x] Refus des types non supportés (`415`)
- [x] Stockage dans `STORAGE_DIR/<documentId>/<nom-original>` derrière une interface `Storage` (pour passer à S3 plus tard)
- [x] Création du document (`status = pending`) + ajout du job

### Ajout d'URL
- [x] Route `POST /documents/url` (body validé par Zod)
- [x] Protection SSRF : http/https uniquement, résolution DNS, refus des IP privées / loopback / link-local
- [x] Création du document + ajout du job

### Gestion
- [x] `GET /documents` (liste + statut + nombre de chunks)
- [x] `GET /documents/:id` (détail + chunks paginés)
- [x] `DELETE /documents/:id` (supprime fichier + document ; chunks en cascade)
- [x] `POST /documents/:id/reindex` (remet `pending` + nouveau job)

**✅Validation** : uploader un PDF et ajouter une URL créent 2 documents `pending` et 2 jobs ; une URL `http://127.0.0.1` est refusée ; un `.exe` renommé en `.pdf` est refusé. ✅

---

## Étape 6 — Parsers (packages/core/parsers) 🟡

Interface commune : `parse(input) → { title, markdown, pages?: { page, startOffset }[] }`

- [x] `markdown.ts` / `txt.ts` : lecture directe
- [x] `pdf.ts` avec `unpdf` : extraction page par page, conservation du numéro de page
- [x] `docx.ts` : `mammoth` → HTML → `turndown` → Markdown
- [x] `html.ts` : `jsdom` + `@mozilla/readability` → `turndown`
- [x] `url.ts` : fetch (timeout, limite de taille, user-agent), puis délégation à `html.ts` ou `pdf.ts` selon le `content-type`
- [x] Règle `turndown` pour conserver les tableaux (plugin GFM)
- [x] Extraction du titre (métadonnées PDF, `<title>`, premier H1, sinon nom du fichier)
- [x] Dossier `fixtures/` avec un exemple par format (dont un PDF avec tableau)
- [x] Tests Vitest pour chaque parser

**✅ Validation** : chaque fixture produit un Markdown lisible ; les titres et tableaux sont conservés ; les pages PDF sont correctement repérées. ✅

---

## Étape 7 — Chunking structurel (packages/core/chunking) 🔴

- [x] Compteur de tokens (`gpt-tokenizer` ou `js-tiktoken`, approximation suffisante)
- [x] Parser le Markdown en AST avec `remark` (`unified` + `remark-parse` + `remark-gfm`)
- [x] Découper par sections (H1 > H2 > H3) en suivant le fil d'Ariane des titres
- [x] Sous-découper les sections trop longues par paragraphes, avec chevauchement (`CHUNK_OVERLAP_TOKENS`)
- [x] Ne jamais couper un tableau ou un bloc de code (s'il dépasse la taille, il forme un chunk à lui seul)
- [x] Fusionner les sections trop courtes avec la suivante (éviter les chunks de 10 tokens)
- [x] Associer chaque chunk à sa page (PDF) grâce aux offsets
- [x] Sortie : `{ index, content, headingPath, page, tokenCount }[]`
- [x] Tests : taille max respectée, tableaux intacts, fil d'Ariane correct, ordre conservé

**✅ Validation** : sur les fixtures, aucun chunk ne dépasse la taille cible (sauf tableau/code isolé), et chaque chunk a un `headingPath` cohérent. ✅

---

## Étape 8 — Embeddings (packages/core/embeddings) 🟢

- [x] Installer `ai` (Vercel AI SDK) + un provider Ollama compatible
- [x] Interface `embed(texts: string[]) → number[][]`
- [x] Traitement par lots de 32
- [x] Texte embeddé = `headingPath + "\n\n" + content` (contextualisation)
- [x] Vérifier la dimension renvoyée (= `EMBEDDING_DIMENSIONS`), sinon erreur explicite
- [x] Retry sur erreur réseau

**✅ Validation** : deux phrases de sens proche ont une similarité cosinus nettement supérieure à deux phrases sans rapport. ✅

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
- [x] Next.js (App Router) + Tailwind + shadcn/ui
- [x] Client API typé (types partagés depuis `packages/core`)

### Page Documents
- [x] Zone de drag & drop multi-fichiers
- [x] Champ d'ajout d'URL
- [x] Liste des documents : titre, type, statut (badge), nombre de chunks, date
- [x] Rafraîchissement auto des statuts tant qu'un document est `pending`/`processing` (polling)
- [x] Actions : ré-indexer, supprimer (avec confirmation)
- [x] Affichage du message d'erreur pour les documents `failed`

### Page Chat
- [ ] Sidebar : liste des conversations + « Nouvelle conversation »
- [ ] Chat avec `useChat` (AI SDK), réponse en streaming
- [ ] Rendu Markdown des réponses (`react-markdown`)
- [ ] Citations `[n]` cliquables → panneau avec titre, page, extrait du chunk
- [ ] État vide (« Aucun document indexé, commencez par en ajouter »)
- [ ] Bouton stop pendant la génération

**✅ Validation (partielle)** : parcours « Page Documents » testé dans le navigateur : upload PDF → `ready` avec titre extrait, ajout URL → `ready`, fichier non supporté → bandeau d'erreur 415, suppression avec confirmation, ré-indexation. La « Page Chat » n'est pas construite : l'API ne supporte pas encore `/chat`/`/conversations` (étapes 11-13). Saut volontaire demandé par l'utilisateur pour tester visuellement upload + parsing avant de continuer dans l'ordre.

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
| 2026-10-15 | 1 | Étape 1 terminée : docker-compose (postgres/redis/ollama), scripts infra:up/down et models:pull. Décision : ports Redis/Ollama remappés sur l'hôte (6380/11435) via POSTGRES_PORT/REDIS_PORT/OLLAMA_PORT car des instances natives tournaient déjà sur les ports standards de cette machine ; LLM_MODEL par défaut = `qwen2.5:7b-instruct`. |
| 2026-10-15 | 2 | Installation drizzle-orm/drizzle-kit/postgres + drizzle.config.ts dans packages/core. |
| 2026-10-15 | 2 | Migration 0000 (`CREATE EXTENSION vector`) générée via `drizzle-kit generate --custom` et testée (appliquée sur Postgres local). `schema.ts` créé en placeholder vide, à remplir à la tâche suivante. |
| 2026-10-15 | 2 | Schéma Drizzle complet (documents/chunks/conversations/messages) + migration 0001 générée et appliquée. `generatedAlwaysAs` de Drizzle a produit le DDL `tsvector GENERATED ALWAYS AS (...) STORED` correct sans besoin de SQL brut. Testé en insérant un chunk avec vecteur 1024d et recherche plein texte. |
| 2026-10-15 | 2 | Étape 2 terminée : index HNSW/GIN/B-tree (migration 0002), scripts `pnpm db:generate`/`db:migrate`/`db:reset`, client `db` + schéma exportés depuis `packages/core`. Tout vérifié manuellement (insert/select via le client, reset qui recrée extension + tables + index). |
| 2026-10-15 | 3 | Étape 3 terminée : API Fastify minimale (`apps/api`) avec plugin `db`, gestionnaire d'erreurs uniforme, route `/health` (check Postgres/Redis/Ollama) et `tsx watch`. Vérifié en conditions réelles : 200 tous services up, 503 après arrêt de Redis, 200 au redémarrage, arrêt propre sur SIGTERM. Port API (3001) géré localement dans `server.ts`, pas ajouté au schéma Zod de `packages/core` (hors périmètre DOCS.md §11). Check Redis fait à la main en RESP brut (pas de dépendance ioredis avant l'étape 4). |
| 2026-10-15 | 4 | Étape 4 terminée : queue `ingestion` (BullMQ) définie dans `packages/core` avec `createIngestionQueue()` (3 tentatives, backoff exponentiel, cleanup après 7 jours), plugin `queue` dans l'API, worker factice qui logue `documentId` dans `apps/worker`. Vérifié en conditions réelles : job ajouté via la queue de l'API consommé et logué par le worker ; retries (3 tentatives, délais croissants ~500ms/~1000ms) vérifiés sur une queue jetable isolée sans toucher au code du worker réel. |
| 2026-10-15 | 5 | Étape 5 terminée : routes `/documents/upload` (multipart, détection réelle du type via `file-type`, fallback par extension pour md/txt/html), `/documents/url` (protection SSRF via résolution DNS + `ipaddr.js`), `GET /documents`, `GET /documents/:id` (chunks paginés), `DELETE`, `POST /reindex`. Interface `Storage`/`LocalStorage` dans `packages/core`. Bug corrigé en cours de route : `STORAGE_DIR` relatif se résolvait différemment selon le cwd de l'API vs du worker — ancré maintenant à la racine du repo. Tout testé en conditions réelles (PDF valide accepté, .exe renommé en .pdf rejeté en 415, URL publique acceptée, 127.0.0.1 et 169.254.169.254 rejetées, path traversal dans le nom de fichier neutralisé, CRUD complet). |
| 2026-10-15 | 6 | Étape 6 terminée : parsers markdown/txt/pdf(unpdf)/docx(mammoth)/html(jsdom+Readability)/url, conversion HTML→Markdown via turndown+plugin GFM (règle custom ajoutée pour les cellules de tableau que mammoth enveloppe dans des `<p>`). Fixtures générées à la main (dont un `.docx` et un `.pdf` avec tableau). 14 tests Vitest, tous verts. `vitest.config.ts` charge maintenant `.env` automatiquement (via `loadEnv` de Vite) — avant, `pnpm test` plantait silencieusement sans `source .env` manuel. |
| 2026-10-15 | 9 (anticipé) | À la demande de l'utilisateur, on saute à l'étape 14 (front) pour tester visuellement upload + parsing. Câblage **minimal** du worker (`apps/worker/src/ingest.ts`) : appelle le bon parser selon `mimeType`/`sourceType`, met à jour `title` et passe le document à `ready`, ou `failed` (avec message) seulement après épuisement des 3 tentatives BullMQ. Pas de chunking/embeddings/hash de dédup ici — ça reste la portée complète de l'étape 9, non cochée. Storage a gagné une méthode `read(documentId)`. Bug corrigé au passage : `POST /documents/url` renvoyait 500 au lieu de 400 sur un domaine inexistant (ENOTFOUND non catché). |
| 2026-10-15 | 14 (partiel) | Front Next.js créé dans `apps/web` (App Router, Tailwind v3, shadcn/ui style "new-york", thème sombre uniquement). Page Documents complète : drag & drop, ajout URL, liste avec badges de statut, polling auto, ré-indexation, suppression avec confirmation, affichage des erreurs. Page Chat non construite (API `/chat` pas encore implémentée). Type `DocumentDTO` partagé via `packages/core` entre l'API et le front. Testé en conditions réelles dans le navigateur (Claude in Chrome) : upload PDF → ready, URL → ready, fichier non supporté → bandeau d'erreur, suppression, ré-indexation. 3 bugs trouvés et corrigés en testant : (1) `create-next-app`/`shadcn@latest` résolvent des versions cassées/instables sur le registre — scaffold fait à la main + CLI shadcn épinglé en 2.10.0 ; (2) mon `tailwind.config.ts` enveloppait les couleurs en `hsl(var(--x))` alors que les variables CSS générées par shadcn sont des `oklch(...)` complets → fond transparent invisible ; (3) `@fastify/cors` n'autorisait pas `DELETE` par défaut (préflight ne listait que GET/HEAD/POST) → `methods` explicite ajouté. |
| 2026-10-15 | 7 | Étape 7 terminée : chunking structurel (`packages/core/chunking`). AST via `remark`/`remark-gfm`, sections par H1/H2/H3 avec fil d'Ariane, fusion des sections < 20 tokens, sous-découpage par nœud (jamais au milieu d'un paragraphe/tableau/code) avec chevauchement, page associée via les offsets `unist`. 21 tests Vitest. Bug trouvé en testant : `takeOverlap` gardait toujours au moins un nœud entier même avec `chunkOverlapTokens: 0` — corrigé pour renvoyer un chevauchement vide dans ce cas. |
| 2026-10-15 | 8 | Étape 8 terminée : embeddings (`packages/core/embeddings`) via `ai` (Vercel AI SDK) + `@ai-sdk/openai-compatible` branché sur l'endpoint OpenAI-compatible d'Ollama (plutôt qu'un package communautaire `ollama-ai-provider` moins maintenu). `embed(texts)` par lots de 32, retry réseau via le `maxRetries` intégré d'`embedMany` (pas de logique maison), erreur explicite si la dimension ne correspond pas à `EMBEDDING_DIMENSIONS`. `chunkToEmbeddingText()` sépare la contextualisation de l'embedding brut. Vérifié en conditions réelles : similarité cosinus 0.74 (phrases proches) vs 0.39 (sans rapport), batching correct sur 70 textes, erreur bien levée avec une dimension forcée à 999. |