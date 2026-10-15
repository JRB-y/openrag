# OpenRag

> Moteur RAG (Retrieval-Augmented Generation) open source en Node.js / TypeScript.
> On alimente une base de connaissances avec des fichiers et des URLs, puis on discute avec elle. Chaque réponse cite ses sources.

---

## 1. Vision du projet

OpenRag permet de :

1. **Importer des connaissances** : fichiers (PDF, DOCX, Markdown, TXT, HTML) et pages web (URLs).
2. **Les indexer intelligemment** : parsing structuré, découpage par sections, embeddings vectoriels et index plein texte.
3. **Les interroger en langage naturel** via un chat qui répond **uniquement** à partir des documents et **cite ses sources** (document, section, page).

Le projet est construit par étapes. On commence par **le moteur seul** (sans authentification ni multi-utilisateurs). Le multi-tenant, l'auth et les évaluations automatisées viendront ensuite (voir [Roadmap](#9-roadmap)).

### Principes

- **100 % TypeScript** de bout en bout (front, API, worker).
- **Bibliothèques open source, reconnues et gratuites** uniquement.
- **Exécutable en local sans clé API** : les modèles tournent via Ollama. Un fournisseur cloud (OpenAI, Anthropic, Mistral…) reste branchable par simple configuration.
- **Qualité mesurable** : chaque choix technique pourra être validé par des évals (phase 2).

---

## 2. Périmètre de la phase 1 : le moteur

| Fonctionnalité | Inclus en phase 1 | Plus tard |
|---|---|---|
| Upload de fichiers (PDF, DOCX, MD, TXT, HTML) | ✅ | Images / OCR |
| Ajout d'URL (une page) | ✅ | Crawl d'un site entier, sitemap |
| Ingestion asynchrone avec statut | ✅ | |
| Déduplication par contenu | ✅ | |
| Ré-indexation manuelle d'un document | ✅ | Sync automatique planifiée |
| Recherche hybride (vecteurs + plein texte) | ✅ | |
| Reranking | ✅ | |
| Chat en streaming avec citations | ✅ | |
| Historique des conversations | ✅ | |
| Authentification, multi-utilisateurs | ❌ | Phase 3 |
| Évaluations automatisées en CI | ❌ | Phase 2 |
| Connecteurs Notion / Confluence | ❌ | Phase 4 |

---

## 3. Stack technique

### Vue d'ensemble

| Couche | Choix | Pourquoi |
|---|---|---|
| Langage | **TypeScript** (Node.js 22 LTS) | Stack habituelle, typage de bout en bout |
| Monorepo | **pnpm workspaces** | Partage de types et de code entre API, worker et front |
| API | **Fastify** | Rapide, mature, bon support du streaming et du multipart |
| Validation | **Zod** | Schémas partagés front/back, validation des entrées |
| Base de données | **PostgreSQL 16 + pgvector** | Vecteurs **et** plein texte dans une seule base, et Row Level Security pour le multi-tenant plus tard |
| ORM / migrations | **Drizzle ORM** + drizzle-kit | Typé, léger, supporte pgvector, SQL brut quand il faut |
| File de jobs | **BullMQ + Redis** | Standard Node pour les traitements en arrière-plan (retries, concurrence) |
| Modèles locaux | **Ollama** | Embeddings et LLM gratuits en local |
| Abstraction LLM | **Vercel AI SDK** (`ai`, licence Apache 2.0) | Streaming, changement de fournisseur sans réécrire le code |
| Reranking | **Transformers.js** (`@huggingface/transformers`) + `bge-reranker-base` (ONNX) | Cross-encoder exécuté directement dans Node, sans service externe |
| Front | **Next.js** + **Tailwind CSS** + **shadcn/ui** | UI moderne, hook `useChat` de l'AI SDK pour le streaming |
| Logs | **Pino** | Logger natif de Fastify, JSON structuré |
| Tests | **Vitest** | Rapide, compatible TypeScript sans configuration |
| Infra locale | **Docker Compose** | Postgres, Redis et Ollama en une commande |

### Parsing des sources

Tout est converti en **Markdown** avant le découpage. Le Markdown conserve la structure (titres, listes, tableaux), ce qui permet un chunking intelligent.

| Source | Bibliothèque |
|---|---|
| PDF | `unpdf` (basé sur pdf.js), extraction page par page |
| DOCX | `mammoth` (DOCX vers HTML) puis `turndown` (HTML vers Markdown) |
| HTML / URL | `jsdom` + `@mozilla/readability` (extrait le contenu principal, sans menus ni pubs) puis `turndown` |
| Markdown / TXT | Lecture directe |
| Détection du type | `file-type` (vérifie le type réel, pas seulement l'extension) |

### Modèles par défaut (configurables)

| Rôle | Modèle par défaut | Remarque |
|---|---|---|
| Embeddings | `bge-m3` via Ollama (1024 dimensions) | Multilingue, très bon en français |
| Génération | Un modèle instruct 7–8B via Ollama | Remplaçable par OpenAI, Anthropic, Mistral via l'AI SDK |
| Reranker | `Xenova/bge-reranker-base` | Exécuté via Transformers.js |

> ⚠️ Changer de modèle d'embeddings impose de ré-indexer. Le modèle utilisé est donc stocké avec chaque chunk.

---

## 4. Architecture

```
┌──────────────┐     HTTP / SSE      ┌──────────────┐
│  apps/web    │ ──────────────────▶ │  apps/api    │
│  Next.js     │ ◀────────────────── │  Fastify     │
└──────────────┘   réponses stream   └──────┬───────┘
                                            │ ajoute un job
                                            ▼
                                     ┌──────────────┐
                                     │    Redis     │
                                     │   (BullMQ)   │
                                     └──────┬───────┘
                                            │ consomme
                                            ▼
┌──────────────┐   embeddings / LLM  ┌──────────────┐
│   Ollama     │ ◀────────────────── │ apps/worker  │
└──────────────┘                     │  ingestion   │
       ▲                             └──────┬───────┘
       │ génération                         │ écrit
       │                                    ▼
       │                             ┌──────────────┐
       └──────────── apps/api ─────▶ │  PostgreSQL  │
                    (recherche)      │  + pgvector  │
                                     └──────────────┘
```

- **apps/api** : reçoit les uploads et les URLs, crée le document en base, pousse un job d'ingestion, sert le chat.
- **apps/worker** : traite l'ingestion (parsing, chunking, embeddings, écriture en base). Séparé de l'API pour que l'UI ne soit jamais bloquée et pour pouvoir le scaler indépendamment.
- **packages/core** : logique métier partagée (parsers, chunker, recherche, prompts, schémas Zod, schéma Drizzle).

---

## 5. Pipeline d'ingestion

### Cycle de vie d'un document

```
pending ──▶ processing ──▶ ready
                 │
                 └──────▶ failed (message d'erreur stocké, relançable)
```

### Étapes

1. **Réception**
   - Fichier : stocké sur disque local (`./storage`, abstrait pour passer sur S3/MinIO plus tard).
   - URL : validée (http/https uniquement, pas d'IP privée, pour éviter les attaques SSRF).
   - Le document est créé avec le statut `pending`, puis un job `ingest-document` est ajouté à la file.

2. **Extraction** : la source est convertie en Markdown (voir tableau des parsers). Pour les PDF, on garde le numéro de page de chaque bloc de texte.

3. **Déduplication** : on calcule un hash SHA-256 du contenu extrait.
   - Si un document identique existe déjà, on ne ré-indexe pas.
   - Lors d'une ré-indexation, si le hash n'a pas changé, on s'arrête là.

4. **Chunking structurel**
   - Découpage d'abord par **titres Markdown** (H1 > H2 > H3), puis par paragraphes si une section est trop longue (`@langchain/textsplitters` en mode Markdown, ou un chunker maison sur la base de `remark`).
   - Taille cible : **~500 tokens**, chevauchement de **~50 tokens**.
   - Les tableaux et blocs de code ne sont **jamais coupés au milieu**.
   - Chaque chunk reçoit son **fil d'Ariane** : `Titre du document > Chapitre > Section`.

5. **Contextualisation** : le texte envoyé au modèle d'embeddings est `fil d'Ariane + contenu du chunk`. Un chunk qui dit « Le délai est de 30 jours » devient trouvable par une question sur « le délai de remboursement ».

6. **Embeddings** : calcul par lots (batch de 32) via Ollama.

7. **Écriture en base** : dans une **transaction**, on supprime les anciens chunks du document puis on insère les nouveaux. Le document passe à `ready`.

8. **Erreurs** : 3 tentatives avec backoff exponentiel (géré par BullMQ). Ensuite, statut `failed` avec le message d'erreur, consultable dans l'UI.

---

## 6. Pipeline de question (chat)

```
Question ─▶ Réécriture ─▶ Recherche hybride ─▶ Reranking ─▶ Génération ─▶ Réponse + citations
            (si historique)  (vecteurs + BM25)   (top 30 → 5)  (streaming)
```

### 1. Réécriture de la question

Si la conversation a un historique, le LLM reformule la question pour qu'elle soit autonome.
Exemple : « Et pour les mineurs ? » devient « Quelles sont les conditions de remboursement pour les mineurs ? ».

### 2. Recherche hybride

Deux recherches en parallèle dans PostgreSQL :

- **Vectorielle** (sens) : similarité cosinus avec l'index HNSW de pgvector. Top 30.
- **Plein texte** (mots exacts : codes, références, noms propres) : `tsvector` + `ts_rank_cd`, avec index GIN. Top 30.

Les deux listes sont fusionnées par **Reciprocal Rank Fusion (RRF)** :

```
score(chunk) = Σ 1 / (60 + rang du chunk dans chaque liste)
```

Le RRF est simple, ne demande aucun réglage de poids et donne de très bons résultats en pratique.

### 3. Reranking

Les 30 meilleurs candidats passent dans un **cross-encoder** (`bge-reranker-base`). Il lit la question et le chunk **ensemble**, ce qui est beaucoup plus précis qu'une simple distance entre vecteurs. On garde les **5 meilleurs**.

**Seuil de pertinence** : si aucun chunk ne dépasse un score minimum, l'assistant répond qu'il n'a pas trouvé l'information dans les documents, **sans appeler le LLM**. Ça évite les hallucinations et les coûts inutiles.

### 4. Génération avec citations

Les chunks retenus sont injectés dans le prompt, numérotés :

```
[1] (Guide RH.pdf, p. 12, Congés > Congés payés)
Le salarié acquiert 2,5 jours ouvrables par mois...

[2] (https://exemple.com/faq, FAQ > Absences)
...
```

Règles du prompt système :
- Répondre **uniquement** à partir des sources fournies.
- Citer chaque affirmation avec `[n]`.
- Si l'information n'est pas dans les sources, le dire clairement.
- Répondre dans la langue de la question.

### 5. Streaming et affichage

- La réponse est streamée vers le front (SSE, via l'AI SDK).
- À la fin, les `[n]` sont reliés aux chunks réels : l'UI affiche des **sources cliquables** (nom du document, page, extrait).
- La question, la réponse et les citations sont enregistrées dans l'historique.

---

## 7. Modèle de données

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents sources
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type   TEXT NOT NULL CHECK (source_type IN ('file', 'url')),
  source_uri    TEXT NOT NULL,          -- chemin de stockage ou URL
  title         TEXT,
  mime_type     TEXT,
  content_hash  TEXT,                   -- SHA-256 du contenu extrait
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error         TEXT,
  chunk_count   INT DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Morceaux indexés
CREATE TABLE chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index      INT NOT NULL,
  content          TEXT NOT NULL,
  heading_path     TEXT,                -- "Guide RH > Congés > Congés payés"
  page             INT,                 -- pour les PDF
  token_count      INT,
  embedding        VECTOR(1024) NOT NULL,
  embedding_model  TEXT NOT NULL,       -- ex. "bge-m3"
  tsv              TSVECTOR GENERATED ALWAYS AS
                   (to_tsvector('simple', coalesce(heading_path, '') || ' ' || content)) STORED,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX chunks_tsv_idx       ON chunks USING gin (tsv);
CREATE INDEX chunks_document_idx  ON chunks (document_id);

-- Conversations
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  citations        JSONB,               -- [{ n, chunkId, documentId, page, excerpt }]
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Note** : la configuration plein texte `simple` fonctionne pour toutes les langues (pas de racinisation). Une configuration par langue (`french`, `english`) pourra être ajoutée plus tard si les évals montrent un gain.

> **Préparation du multi-tenant** : en phase 3, une colonne `tenant_id` sera ajoutée à toutes les tables, avec des politiques **Row Level Security**. Le schéma est pensé pour que cet ajout soit une simple migration.

---

## 8. API (phase 1)

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/documents/upload` | Upload d'un ou plusieurs fichiers (multipart) |
| `POST` | `/documents/url` | Ajout d'une URL `{ url }` |
| `GET` | `/documents` | Liste des documents avec leur statut |
| `GET` | `/documents/:id` | Détail d'un document et de ses chunks |
| `POST` | `/documents/:id/reindex` | Relance l'ingestion |
| `DELETE` | `/documents/:id` | Supprime le document et ses chunks |
| `POST` | `/chat` | Envoie une question, réponse en streaming |
| `GET` | `/conversations` | Liste des conversations |
| `GET` | `/conversations/:id` | Messages d'une conversation avec citations |
| `GET` | `/health` | État de l'API, de la base, de Redis et d'Ollama |

### Limites de la phase 1

- Taille maximale d'un fichier : 25 Mo (configurable).
- Types acceptés : PDF, DOCX, MD, TXT, HTML.
- URLs : une seule page par ajout (pas de crawl).

---

## 9. Roadmap

### Phase 1 : le moteur (en cours)
Tout ce qui est décrit dans ce document.

### Phase 2 : évaluations
- Jeu de test de 50 à 100 questions, avec réponse attendue et chunk source attendu.
- Métriques :
  - **Recall@5** : le bon chunk est-il dans les 5 résultats ?
  - **Fidélité** : la réponse s'appuie-t-elle uniquement sur les sources ? (LLM juge)
  - **Pertinence** : la réponse répond-elle à la question ?
- Comparaisons chiffrées : vecteurs seuls vs hybride, avec et sans reranking, tailles de chunks.
- Lancement en CI (GitHub Actions) : une PR qui dégrade les scores est bloquée.
- Outil envisagé : **promptfoo** (open source) ou un runner maison avec Vitest.

### Phase 3 : multi-utilisateurs
- Authentification (**Better Auth**, open source).
- Workspaces / tenants, avec isolation par **Row Level Security** PostgreSQL.
- Test automatisé qui tente d'accéder aux données d'un autre tenant et doit échouer.
- Quotas par workspace.

### Phase 4 : connecteurs et sync
- Crawl de site (sitemap), Notion, Confluence, Google Drive.
- Synchronisation incrémentale planifiée (jobs BullMQ répétables).

### Phase 5 : production
- Observabilité des requêtes RAG avec **Langfuse** (open source, auto-hébergeable) : chunks retrouvés, latence, coût.
- Stockage des fichiers sur S3 / MinIO.
- Cache sémantique des questions fréquentes.
- Déploiement (Docker, CI/CD).

---

## 10. Structure du repo

```
openrag/
├── apps/
│   ├── api/                  # Fastify : routes documents, chat, health
│   │   └── src/
│   │       ├── routes/
│   │       ├── plugins/      # db, queue, multipart, cors
│   │       └── server.ts
│   ├── worker/               # Consommateur BullMQ : ingestion
│   │   └── src/
│   │       ├── jobs/ingest-document.ts
│   │       └── index.ts
│   └── web/                  # Next.js : upload, liste des documents, chat
│       └── src/
├── packages/
│   └── core/
│       └── src/
│           ├── db/           # schéma Drizzle, migrations, client
│           ├── parsers/      # pdf.ts, docx.ts, html.ts, url.ts, markdown.ts
│           ├── chunking/     # chunker structurel
│           ├── embeddings/   # client d'embeddings (Ollama / AI SDK)
│           ├── retrieval/    # recherche hybride, RRF, reranker
│           ├── generation/   # prompts, réécriture, citations
│           └── schemas/      # schémas Zod partagés
├── storage/                  # fichiers uploadés (ignoré par git)
├── docker-compose.yml        # postgres (pgvector), redis, ollama
├── .env.example
├── pnpm-workspace.yaml
└── DOCS.md
```

---

## 11. Configuration (`.env`)

```bash
# Base de données
DATABASE_URL=postgres://openrag:openrag@localhost:5432/openrag

# File de jobs
REDIS_URL=redis://localhost:6379

# Modèles
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=bge-m3
EMBEDDING_DIMENSIONS=1024
LLM_PROVIDER=ollama          # ollama | openai | anthropic | mistral
LLM_MODEL=                   # nom du modèle chez le fournisseur choisi
RERANKER_MODEL=Xenova/bge-reranker-base

# Recherche
RETRIEVAL_TOP_K=30           # candidats par méthode de recherche
RERANK_TOP_N=5               # chunks envoyés au LLM
RERANK_MIN_SCORE=0.3         # seuil sous lequel on répond "non trouvé"

# Ingestion
CHUNK_SIZE_TOKENS=500
CHUNK_OVERLAP_TOKENS=50
MAX_UPLOAD_MB=25
STORAGE_DIR=./storage
```

---

## 12. Démarrage (cible)

```bash
# 1. Lancer l'infrastructure
docker compose up -d

# 2. Télécharger les modèles
docker compose exec ollama ollama pull bge-m3
docker compose exec ollama ollama pull <modèle-llm>

# 3. Installer et migrer
pnpm install
pnpm db:migrate

# 4. Lancer API, worker et front
pnpm dev
```