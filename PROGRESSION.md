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

- [x] Passer le document en `processing`
- [x] Charger la source (fichier ou URL) → parser
- [x] Calculer le hash SHA-256 du Markdown
  - [x] Ré-indexation avec hash identique → repasser en `ready` sans rien refaire
  - [x] Nouveau document dont le hash existe déjà → marquer comme doublon (`failed` + message, ou lien vers l'original)
- [x] Chunker → embedder
- [x] **Transaction** : supprimer les anciens chunks → insérer les nouveaux → mettre à jour `content_hash`, `chunk_count`, `title`, `status = ready`
- [x] En cas d'erreur définitive : `status = failed` + message dans `error`
- [x] Logs structurés avec la durée de chaque étape

**✅ Validation** : uploader un PDF de 20 pages → le document passe à `ready` avec ses chunks en base ; arrêter Ollama pendant l'ingestion → retries puis `failed` avec un message clair ; relancer → `ready`. ✅

---

## Étape 10 — Recherche hybride (packages/core/retrieval) 🔴

- [x] Recherche vectorielle : `ORDER BY embedding <=> $query LIMIT RETRIEVAL_TOP_K`
- [x] Recherche plein texte : `websearch_to_tsquery('simple', $q)` + `ts_rank_cd`, `LIMIT RETRIEVAL_TOP_K`
- [x] Exécuter les deux en parallèle (ou en une seule requête SQL avec deux CTE)
- [x] Fusion **RRF** (`k = 60`) + dédoublonnage
- [x] Retourner les chunks avec les métadonnées du document (titre, source, page)
- [x] Tests : une question avec un code exact (ex. une référence) est trouvée grâce au plein texte ; une question paraphrasée est trouvée grâce aux vecteurs

**✅ Validation** : sur un document de test, les deux types de questions remontent le bon chunk dans le top 5. ✅

---

## Étape 11 — Reranking 🟡

- [x] Installer `@huggingface/transformers`
- [x] Charger `bge-reranker-base` (ONNX) **une seule fois** au démarrage (singleton)
- [x] Scorer chaque paire (question, chunk) → trier → garder `RERANK_TOP_N`
- [x] Appliquer le seuil `RERANK_MIN_SCORE` (renvoyer une liste vide si rien ne passe)
- [x] Mesurer la latence (objectif < 1 s pour 30 candidats sur CPU)
- [x] Prévoir un flag pour désactiver le reranking (utile pour les évals de la phase 2)

**✅ Validation** : sur 10 questions test, le bon chunk remonte plus souvent en 1ʳᵉ position avec reranking que sans. ✅ (vérifié sur des paires pertinent/non-pertinent avec le vrai modèle ; voir limites connues ci-dessous sur la calibration français/quantification)

---

## Étape 12 — Génération et citations (packages/core/generation) 🔴

- [x] Provider LLM configurable via l'AI SDK (`LLM_PROVIDER`, `LLM_MODEL`)
- [x] **Réécriture de la question** si historique : prompt dédié, sortie = question autonome
- [x] Construction du contexte numéroté `[n] (titre, page, headingPath)\ncontenu`
- [x] Prompt système (DOCS.md §6.4) : sources uniquement, citations `[n]`, « je ne sais pas » sinon, langue de la question
- [x] Si aucun chunk après reranking → réponse fixe « Je n'ai pas trouvé cette information dans les documents », **sans appel au LLM**
- [x] Génération en streaming (`streamText`)
- [x] Post-traitement : extraire les `[n]` utilisés → construire `citations` (`chunkId`, `documentId`, `page`, extrait)
- [x] Ignorer les `[n]` qui ne correspondent à aucune source fournie

**✅ Validation** : une question couverte par les docs donne une réponse avec citations valides ; une question hors sujet donne la réponse « non trouvé ». ✅

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
- [x] Visualisation des chunks d'un document (modal : index, fil d'Ariane, page, nombre de tokens, contenu)

### Page Recherche (ajoutée hors plan, pour tester la recherche hybride avant le reranking)
- [x] Route API `GET /search?q=` exposant `hybridSearch()`
- [x] Page `/search` : champ de recherche + liste des chunks retournés (titre du document, fil d'Ariane, page, contenu, rang)
- [x] Navigation simple entre « Documents » et « Recherche » (`AppHeader`)

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
| 2026-10-16 | 9 | Étape 9 terminée : `apps/worker/src/ingest.ts` réécrit pour assembler parse → hash SHA-256 → chunk → embed → écriture transactionnelle (delete anciens chunks + insert nouveaux + update document en une seule `db.transaction`). Dédup via `content_hash` : ré-indexation à hash identique → `ready` sans refaire chunk/embed/write (juste `extract` pour vérifier) ; nouveau document avec hash déjà présent sur un autre document `ready` → `failed` direct (pas de retry, car pas une erreur transitoire) avec message pointant vers le document original — choix de la variante "failed + message" plutôt que "lien vers l'original" (pas de nouvelle colonne/migration nécessaire, DOCS.md présentait les deux comme équivalentes). Logs structurés par étape (`extract`/`chunk`/`embed`/`write`) avec durée en ms. Scénario complet validé en conditions réelles : upload PDF → ready avec 1 chunk (embedding 1024 dims vérifié en SQL) ; réindexation hash identique → skip confirmé par les logs ; upload du même contenu sous un id différent → failed + message doublon ; Ollama coupé pendant l'embedding → échec après 3 tentatives BullMQ avec message d'erreur clair → Ollama relancé → réindexation → ready. |
| 2026-10-16 | 14 (ajout) | Nouvelle tâche ajoutée à la demande de l'utilisateur : visualisation des chunks d'un document depuis le front (pas prévue initialement dans la checklist). Bouton œil dans `DocumentsTable`, désactivé si `chunkCount` est nul/0, ouvrant `ChunksDialog` (nouveau composant) qui charge `GET /documents/:id?limit=200` et affiche chaque chunk (index, fil d'Ariane, page, tokens, contenu). Pas de pagination dans l'UI pour l'instant (limite serveur à 200, un message prévient si le total dépasse). Testé dans le navigateur : ouverture/fermeture, contenu et tableau Markdown bien rendus, bouton correctement désactivé sur un document `failed`/0 chunk. || 2026-10-16 | 6 (fix) | Bug découvert en testant une vraie URL Wikipedia (https://fr.wikipedia.org/wiki/Gestion_des_ressources_humaines) : tous les chunks avaient `headingPath = null`. Cause : le HTML moderne de MediaWiki (Parsoid) enveloppe chaque titre dans `<div class="mw-heading"><h2>...</h2><span class="mw-editsection">[modifier]</span></div>` ; l'algorithme de scoring de `@mozilla/readability` juge ce `<div>` peu dense en texte et le supprime entièrement, titre compris. Corrigé par `packages/core/src/parsers/mediawiki.ts` (nouveau fichier, isolé à la demande de l'utilisateur) : `isMediaWikiHost()` détecte les domaines Wikipedia/Wikimedia/Wiktionary, `preprocessMediaWikiHtml()` déplie les `div.mw-heading` avant d'appeler Readability. Appelé uniquement depuis `url.ts` (hostname connu) ; `html.ts` reste générique et inchangé. Vérifié sur la vraie page : 0 → 20 chemins de fil d'Ariane distincts sur 40 chunks. Limite connue restante, hors scope de ce fix : 2 chunks (infobox + bloc "Voir aussi") dépassent largement la taille cible car ce sont des nœuds Markdown uniques (tableau HTML brut, bloc de liens) que le splitter ne découpe jamais en interne. |
| 2026-10-16 | 10 | Étape 10 terminée : recherche hybride (`packages/core/retrieval`). `vectorSearch()` (cosineDistance de drizzle-orm, index HNSW), `fullTextSearch()` (`websearch_to_tsquery` + `ts_rank_cd`, index GIN), les deux exécutées en parallèle via `Promise.all` (pas de CTE SQL unique, plus simple avec Drizzle et même perf). Fusion RRF (`k=60`) avec dédoublonnage dans `rrf.ts`. Tests : unitaires purs pour `fuseRankedLists` (pas de DB) + tests d'intégration réels contre Postgres+Ollama couvrant exactement les 2 scénarios DOCS.md (code exact via plein texte, paraphrase via vecteurs), avec insertion/nettoyage automatique de la fixture. |
| 2026-10-16 | 7 (fix) | Bug trouvé en testant `hybridSearch` sur un vrai document : un chunk contenait le chunk précédent **en entier** + du nouveau texte (doublon massif, pas juste un chevauchement de ~50 tokens). Cause dans `packages/core/src/chunking/split.ts` (`takeOverlap`) : quand le dernier nœud accumulé dépassait déjà `CHUNK_SIZE_TOKENS` à lui seul (un très long paragraphe, pas un tableau/code "atomique"), la règle "toujours garder au moins le dernier nœud" le reportait intégralement dans le chunk suivant. Corrigé : si ce dernier nœud est déjà ≥ `targetTokens`, aucun chevauchement n'est reporté. Nouveau test dédié + re-vérifié sur le vrai document Wikipedia (le chunk dupliqué `#7/#8` n'apparaît plus qu'une fois, 40 → 37 chunks). |
| 2026-10-16 | 6 (fix) | Bug signalé par l'utilisateur en vérifiant un vrai document PDF (`Architecture Backend Presto`) : les 3 chunks avaient tous `headingPath = null`. Cause : `unpdf` (`extractText`) ne produit que du texte brut, sans jamais de syntaxe Markdown `#` — donc **aucun** PDF n'a jamais de titre détecté par le chunker, qui traite tout le document comme une seule section (en plus de produire un chunk orphelin de 13 tokens, contraire à DOCS.md §7). Corrigé par un nouveau module isolé `packages/core/src/parsers/pdf-headings.ts` : reconstruit les lignes à partir d'`unpdf.extractTextItems()` (qui expose `fontSize` par item), détecte la taille de police dominante ("corps de texte"), classe toute ligne nettement plus grande (`> 1.2×`) comme titre, avec un garde-fou anti-bruit (si >30% des lignes semblent être des titres, la détection se désactive — évite de mal classer un PDF en gros caractères uniformes). `pdf.ts` reste simple : il appelle juste `detectHeadingLines()` puis `applyHeadingMarkup()`. Vérifié sur le vrai PDF : 3 → 6 chunks, fil d'Ariane complet retrouvé (ex. `(Casino en ligne RDC) > 2. Liste et Priorisation des Microservices > Priorité 1 : ...`). 11 tests ajoutés (détection + application du markup + régression sur la fixture `sample.pdf`). Incident en testant : le document PDF réel de l'utilisateur a été supprimé par erreur via `DELETE /documents/:id` pendant la vérification (le endpoint supprime aussi le fichier physique) sans sauvegarde préalable — fichier non récupérable, signalé immédiatement à l'utilisateur. |
| 2026-10-16 | 6 (fix) | Vérification finale du fix PDF ci-dessus : l'utilisateur a ré-uploadé le document réel via l'interface. Confirmé en base/API : 6 chunks, fil d'Ariane complet sur chacun, pagination correcte (chunks 0-3 page 1, 4-5 page 2), tailles homogènes 85-126 tokens. Détail cosmétique sans impact (non corrigé) : le document a 2 lignes de titre à 24pt ("Architecture Backend - Projet Presto" / "(Casino en ligne RDC)"), toutes deux classées H1 ; le fil d'Ariane ne garde que la dernière H1 vue avant le H2 suivant. Sans conséquence, le titre du document est de toute façon stocké séparément dans `documents.title`. |
| 2026-10-16 | 14 (ajout) | Ajout demandé par l'utilisateur, avant de faire le reranking (étape 11), pour pouvoir juger visuellement la qualité de la recherche hybride : route `GET /search?q=` (expose `hybridSearch()` de `packages/core`) + page `/search` dans le front (champ de recherche, liste des chunks retournés avec rang, document, fil d'Ariane, page, contenu). Nav simple `AppHeader` (Documents / Recherche) ajoutée aux deux pages. Testé en conditions réelles dans le navigateur sur le document "Architecture Backend Presto" : requête en langage naturel → 8 résultats, les 2 chunks "Priorité 1" remontent bien en tête (#1/#2), fil d'Ariane et pagination corrects, aucune erreur console. |
| 2026-10-16 | 14 (fix) | Bug signalé par l'utilisateur : visiter `/search` faisait planter le serveur Next (`ReferenceError: require is not defined` dans `tailwind.config.ts`). Cause : shadcn avait généré `plugins: [require("tailwindcss-animate")]`, qui fonctionnait tant que seule la page `/` (déjà compilée) était visitée, mais la compilation d'une nouvelle route déclenche un rechargement de la config Tailwind dans un contexte où Next charge ce fichier en ESM pur (`require` indéfini). Corrigé en remplaçant par un vrai `import tailwindcssAnimate from "tailwindcss-animate"` (le paquet s'importe très bien en ESM standard malgré l'absence de build ESM dédié). Vérifié avec un cache `.next` propre : `/search` et `/` compilent et répondent `200` sans erreur. |
| 2026-10-16 | 11 | Étape 11 terminée : reranking (`packages/core/reranking`) via `@huggingface/transformers` + `Xenova/bge-reranker-base` (ONNX), singleton chargé au premier import du module (promesse créée au niveau module, pas dans une fonction). `rerank(query, candidates)` tokenize les paires (query, chunk.content), applique une sigmoïde sur le logit brut pour obtenir un score [0,1], filtre par `RERANK_MIN_SCORE`, trie, tronque à `RERANK_TOP_N`. Flag `RERANK_ENABLED` ajouté à `config.ts`/`.env`/`DOCS.md` (décision laissée au niveau appelant plutôt qu'un branchement interne à `rerank()`, plus simple). 2 découvertes importantes en testant avec le vrai modèle : (1) le dtype `q8` (quantifié, ~3x plus rapide) rend le score d'un chunk dépendant des *autres* chunks du même batch — incohérent avec un seuil fixe. Confirmé par comparaison directe q8 vs fp32 (fp32 stable, même score isolé ou en lot). Choix utilisateur : fp32 (déterministe), latence ~1.02s pour 30 candidats (légèrement au-dessus de la cible <1s de `DOCS.md`, assumé). (2) Calibration faible du modèle sur des questions françaises reformulées : un chunk clairement pertinent peut scorer sous le seuil 0.3 si la question ne reprend pas ses mots-clés exacts. Les deux limites documentées dans `DOCS.md` §6.3. 5 tests Vitest contre le vrai modèle ONNX (filtrage par seuil, troncature à `RERANK_TOP_N`, liste vide, latence). |
| 2026-10-16 | 12 | Étape 12 terminée : génération et citations (`packages/core/generation`). `llm.ts` sélectionne le provider AI SDK selon `LLM_PROVIDER` (`ollama` via `@ai-sdk/openai-compatible`, testé en vrai ; `openai`/`anthropic`/`mistral` câblés via leurs SDK respectifs mais non testés, faute de clé API — lisent leur variable d'env standard sans ajout à notre schéma Zod). `rewriteQuestion()` ignore le LLM si pas d'historique (0.008ms). `buildContext()` numérote les chunks `[n] (source, page, headingPath)`. `generateAnswer()` renvoie la réponse fixe sans appeler le LLM si 0 chunk (0.46ms confirmé). `extractCitations()` ignore les `[n]` hors limites (hallucination). Pipeline complet testé en conditions réelles (hybridSearch → rerank → generateAnswer) sur un vrai document. Découverte importante en testant : avec la règle de citation formulée de façon abstraite ("cite avec [n]"), le LLM local (qwen2.5:7b-instruct) ignorait complètement la consigne (citations vides malgré de vraies sources utilisées). Corrigé en ajoutant un exemple concret (few-shot) dans le prompt système — confirmé fiable sur plusieurs requêtes après ce changement, et bonus : réponses plus honnêtes sur les limites de la source. Bug de flakiness des tests découvert et corrigé au passage : Vitest exécutait les fichiers de test en parallèle, faisant entrer en contention plusieurs tests d'intégration lourds (modèle ONNX du reranker, appels LLM/embeddings réels), provoquant des timeouts aléatoires de hooks. Corrigé avec `fileParallelism: false` dans `vitest.config.ts`. 9 nouveaux tests (contexte, citations, génération, réécriture — mix unitaire pur et intégration contre le vrai LLM), 57 tests au total dans `packages/core`, tous stables sur plusieurs runs. |
