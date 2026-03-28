# RAG Infrastructure for True Recall

## Context & Vision

The user's Obsidian vault serves as a **personal knowledge base for grounding AI agents** -- not just a note-taking system. Notes are added as reference material, context for future conversations, and learning resources. Flashcards are a subset: things that are hard, need deeper understanding, or require memorization. A note without flashcards does NOT mean a knowledge gap -- it may be reference material, something "for later", or a well-known topic.

**Problem**: When an MCP agent (Claude Code, etc.) needs to discuss a topic with the user, it currently has two bad options: read the entire vault (too many tokens, slow) or blindly guess which notes are relevant.

**Goal**: Build RAG infrastructure so agents are **context-aware** about the user's knowledge. The agent knows which notes exist, which flashcards exist, what FSRS state those flashcards are in -- and can have an informed conversation based on that. Not a search tool. Not a report generator. Infrastructure for agents that don't hallucinate because they have the user's actual knowledge to draw from.

**Primary consumer**: MCP tools (Claude Code and other agents).
**Secondary**: Sidebar chat view in plugin (Pro-only) -- a conversational interface to talk to your knowledge base directly in Obsidian.
**Tertiary**: Local API endpoints for external integrations.

**Tier restriction**: RAG is a **Pro-only feature**. BYOK users retain existing functionality (flashcard generation, review, etc.) but do not get knowledge base indexing/search. Embedding API calls go through the Pro LiteLLM proxy, not directly to OpenRouter. This means:
- Settings tab only visible when `aiTier === "pro"`
- MCP tools return "Pro subscription required" for non-Pro users
- Embedding requests route through `https://ai.truerecall.app/v1/embeddings`
- No need for users to configure embedding model separately (Pro proxy handles it)

### Key Use Cases (from brainstorming)

1. **"Przeanalizuj moje notatki pod katem GABA receptorow"** -- agent calls `search_knowledge`, gets relevant chunks from notes + flashcards with FSRS data, can discuss the topic grounded in the user's actual material, find inconsistencies across notes
2. **"Co mam o kofeinie?"** -- agent retrieves all related content, sees 12 flashcards (8 mature, 2 learning, 2 problematic), 3 notes with relevant sections, and can have an informed conversation
3. **Knowledge-aware conversation** -- agent knows mastery levels from FSRS data, doesn't re-explain what the user already knows well (high stability), focuses on gaps and weak areas

### What This Is NOT
- Not Smart Connections (which sucks at this according to the user)
- Not NotebookLM (external, misses flashcard data, no FSRS awareness)
- Not a structured "knowledge audit report" -- it's conversational infrastructure
- Not a full chat app -- sidebar is single-purpose: talk to your knowledge

---

## Research: Embedding Models (as of March 2026)

### Google's Latest

**Gemini Embedding 2** (March 2026) -- first natively multimodal embedding model (text, images, video, audio, documents). 3072 dims, Matryoshka Representation Learning (MRL) for dimension truncation. $0.20/MTok. Overkill for text-only RAG.

**Gemini Embedding 001** (GA October 2025) -- text-only, 3072 dims, top of MTEB multilingual leaderboard (68.32). Available on OpenRouter at $0.15/MTok. 20K token context window. Best quality but 15x the cost of BGE-M3.

### Full Model Comparison

| Model | Dims | $/MTok | Context | MTEB Score | Notes |
|-------|------|--------|---------|------------|-------|
| **baai/bge-m3** | 1024 | **$0.01** | 8K | 63.0 | Best value. Open-source. Top multilingual open model. |
| **alibaba/qwen3-embedding-8b** | flex (up to 7168) | **$0.01** | 32K | 70.58 (#1) | Highest quality open model. MRL support. Apache 2.0. |
| **alibaba/qwen3-embedding-8b** | flex (up to 7168) | **$0.01** | 32K | 70.58 (#1) | Highest quality open model. MRL support. Apache 2.0. |
| openai/text-embedding-3-small | 1536 | $0.02 | 8K | ~62 | OpenAI quality at low price |
| google/gemini-embedding-001 | 3072 | $0.15 | 20K | 68.32 | Premium quality, multilingual |
| openai/text-embedding-3-large | 3072 | $0.13 | 8K | ~64 | OpenAI's premium option |
| voyage-3-lite | 512 | $0.02 | 32K | ~60 | Cheapest decent option |

### Local/In-Browser Options

- **all-MiniLM-L6-v2** via Transformers.js: 22M params, ~23MB quantized ONNX, 384 dims. Could run in Electron but adds significant download size. Only viable as opt-in for privacy-focused users.
- **Nomic Embed v1.5** via ONNX: 768 dims, ~33MB. Better quality than MiniLM but larger.
- Trade-off: local = free + private, but adds 23-33MB to plugin size and slower on CPU.

### Recommendation

**Default: BGE-M3 via OpenRouter at $0.01/MTok.** Reasons:
1. Same API key as chat -- zero extra configuration
2. Absurdly cheap: 10,000-note vault costs $0.08 total
3. Excellent multilingual support (important for Polish notes)
4. 1024 dims = 4KB per chunk = manageable storage
5. Available through OpenRouter's OpenAI-compatible `/api/v1/embeddings` endpoint

### Cost Estimates

| Vault Size | Notes | Chunks (~2/note) | Cost (BGE-M3) | Cost (Gemini) |
|------------|-------|-------------------|---------------|---------------|
| Small | 500 | ~1,000 | $0.004 | $0.06 |
| Medium | 2,000 | ~4,000 | $0.016 | $0.24 |
| Large | 10,000 | ~20,000 | $0.08 | $1.20 |
| XL | 50,000 | ~100,000 | $0.40 | $6.00 |

Ongoing costs negligible with incremental indexing (only changed notes re-embedded).

---

## Research: Vector Storage Options

### Option A: Flat Cosine in SQLite (RECOMMENDED)

Store embeddings as BLOBs in existing SQLite, compute cosine similarity in JavaScript.

**Pros:**
- Zero new dependencies
- Uses existing db infrastructure
- Atomic with card data (single db file)
- O(n) scan benchmarks ~10ms for 50K chunks (Float32Array operations are SIMD-optimized in V8)

**Cons:**
- O(n) doesn't scale past ~100K chunks
- No approximate nearest neighbor (ANN) speedup
- Must load all embeddings into memory for search

**Verdict:** Perfect for Phase 1. Covers 99% of Obsidian vaults.

### Option B: sqlite-vec

Pure C extension for KNN vector search. SIMD-accelerated. Proper indexed search.

**Pros:**
- Blazing fast (ANN search)
- Stays in SQLite ecosystem
- Scales to millions of vectors

**Cons:**
- **Critical blocker**: Cannot be dynamically loaded into WASM SQLite. Requires building a custom WASM binary with sqlite-vec statically compiled in.
- Medium-high effort to build custom `@sqlite.org/sqlite-wasm` with extension

**Verdict:** Great v2 target if flat cosine becomes a bottleneck.

### Option C: Orama

Complete search engine: full-text + vector + hybrid search. <2KB core. Browser/Node.js native.

**Pros:**
- Built-in BM25 + vector fusion (hybrid search out of the box)
- Excellent TypeScript API
- Tiny footprint

**Cons:**
- Second data store alongside SQLite (sync complexity)
- Persistence via JSON serialization (not as robust as SQLite)
- Another dependency to maintain

**Verdict:** Good alternative if we want richer hybrid search features in Phase 2.

### Option D: Vectra

JSON-file vector DB by Microsoft. Simple API.

**Pros:** Simple, no native deps
**Cons:** File I/O overhead in Obsidian, limited features, not actively maintained
**Verdict:** Not recommended.

### Option E: hnswlib-node

Fast ANN search + SQLite persistence.

**Pros:** Very fast ANN
**Cons:** Native C++ dependency = Electron compatibility nightmare (same issues as better-sqlite3)
**Verdict:** Not recommended for Obsidian plugins.

### Decision

**Phase 1: Flat cosine in SQLite (Option A)** -- zero deps, adequate perf.
**Phase 2 (if needed): Orama (Option C)** or custom WASM build with sqlite-vec (Option B).

---

## Research: Chunking Strategies

### Existing Code

`src/features/ai/services/markdown-chunker.ts` already implements heading-aware splitting:
- `filterContent()` -- strips frontmatter, code blocks, comments, images
- Heading detection with `HEADING_RE = /^(#{1,6})\s+(.+)$/`
- Breadcrumb building from heading stack
- Paragraph-level splitting for oversized sections
- Target: 3000 words (for generation context)

For RAG, we need ~400-512 tokens per chunk (vs 3000 words) for better granularity.

### RAG Chunking Best Practices

1. **Heading-aware splitting** -- respect document structure, never split mid-section
2. **Overlap** -- 50-100 token overlap between chunks prevents losing context at boundaries
3. **Code blocks** -- keep intact as single chunks (even if they exceed target size)
4. **LaTeX** -- keep `$...$` and `$$...$$` blocks intact
5. **Wikilinks** -- resolve `[[Note Name]]` to full text for embedding
6. **Frontmatter** -- strip from content, store as metadata (tags, etc.)
7. **Tables** -- keep intact as single chunks

### Flashcard Chunking

Each flashcard becomes a single chunk:
```
Q: {front field}
A: {back field}
Source: {source_text from note}
Tags: {tags}
```

This ensures flashcard content is searchable alongside notes.

---

## Research: Hybrid Search

### Why Hybrid?

Pure keyword search misses semantic matches ("caffeine effects" won't match "coffee's impact on sleep").
Pure vector search misses exact terms (searching for "FSRS" might return general "spaced repetition" chunks).
Hybrid combines both for best results.

### Reciprocal Rank Fusion (RRF)

Simple, effective method to merge two ranked lists:

```
RRF_score(doc) = 1/(k + rank_keyword) + 1/(k + rank_vector)
```

Where k=60 (standard constant). Documents appearing in both lists get boosted.

**Why RRF over alternatives:**
- No score normalization needed (keyword scores and cosine scores have different scales)
- Works with any number of rankers
- Empirically matches or beats more complex fusion methods
- Zero configuration

### FTS5 Already Available

The existing WASM SQLite binary includes FTS5 (proven by `notes_fts` table). We just add another FTS5 virtual table for RAG chunks. BM25 ranking comes free with FTS5.

---

---

## Proxy Changes (true-recall-proxy)

The LiteLLM proxy currently only routes chat completions. Embeddings need to be added.

### Current State
- Single model: `openrouter/google/gemini-2.5-flash` for chat
- Custom callback (`custom_callbacks.py`): `ModelRouterHandler.async_pre_call_hook` handles model routing + prompt injection
- Budget tracking: LiteLLM auto-tracks spend per API key (including embeddings once configured)
- No embedding model configured, no `/v1/embeddings` endpoint active

### Required Changes

#### 1. `litellm_config.yaml` -- add embedding model

```yaml
model_list:
  - model_name: "auto"
    litellm_params:
      model: "openrouter/google/gemini-2.5-flash"
      api_key: "os.environ/OPENROUTER_API_KEY"
      timeout: 60
      max_retries: 2
  - model_name: "embedding"           # NEW
    litellm_params:                    # NEW
      model: "openrouter/baai/bge-m3"  # NEW
      api_key: "os.environ/OPENROUTER_API_KEY"  # NEW
```

LiteLLM natively supports `/v1/embeddings` once a model is configured. The plugin calls `POST https://ai.truerecall.app/v1/embeddings` with `model: "embedding"` and LiteLLM routes it to OpenRouter's BGE-M3.

#### 2. `custom_callbacks.py` -- no changes needed

The `async_pre_call_hook` receives `call_type` parameter. For embeddings, `call_type = "embedding"`. The current code only injects prompts for `call_context` in `["generation", "grading"]`, so embedding calls pass through unmodified. Model routing via key metadata (`target_model`) still works if we ever want per-user embedding model overrides.

#### 3. Budget tracking -- automatic

LiteLLM automatically logs embedding API spend to `LiteLLM_SpendLogs` and deducts from the user's `max_budget`. BGE-M3 at $0.01/MTok means even heavy indexing uses < $0.10 -- negligible against the $4/month Pro budget.

#### 4. Deployment

```bash
# Update config on ZimaBlade
ssh zimablade
cd /home/lucas/docker/true-recall-proxy
# Edit litellm_config.yaml to add embedding model
docker compose restart proxy
```

No Dockerfile rebuild needed -- just config change + restart.

### Plugin Embedding Service Integration

The `RagEmbeddingService` calls the **same proxy URL** as chat:

```typescript
// Pro tier: through LiteLLM proxy
const url = "https://ai.truerecall.app/v1/embeddings";
const headers = { Authorization: `Bearer ${proKey}`, "Content-Type": "application/json" };
const body = { model: "embedding", input: texts };
```

The plugin's `ai-client-config.ts` already resolves Pro tier → LiteLLM URL. The embedding service reuses this pattern. No new API keys, no new URLs, no new auth -- the user's existing Pro key just works.

---

## Documentation Changes (true-recall-docs)

### Pages to Create

#### `configuration/knowledge-base.md` (new page)

New documentation page for the RAG/Knowledge Base feature. Contents:
- What is the Knowledge Base (semantic search over notes + flashcards)
- Pro-only feature callout
- Settings: enable, include/exclude folders, embedding model, auto-index toggle
- How indexing works (automatic on file changes, manual trigger)
- How to trigger reindex via MCP or settings
- How agents use it (MCP tools reference)

Sidebar order: after ai-settings.md (order: 4).

### Pages to Update

#### `reference/mcp-server.md`

Add new section "Knowledge Base" between "Database" and "Backup":

```markdown
### Knowledge Base

:::note
Knowledge Base tools require a Pro subscription. BYOK users will receive a "Pro subscription required" error.
:::

| Tool | Parameters | Description |
|------|-----------|-------------|
| `search_knowledge` | `query`, `topK?`, `sourceType?` | Semantic search over notes and flashcards. Returns ranked chunks with FSRS data for flashcards |
| `index_knowledge` | `full?` | Trigger knowledge base reindex (incremental by default) |
| `get_knowledge_status` | — | Index stats: chunks indexed, sources, last indexed timestamp |
```

Add example workflow:

```markdown
### Ask about your knowledge

\`\`\`
You: What do I know about caffeine?
Claude: [calls search_knowledge("caffeine") → shows notes, flashcards with mastery levels]
\`\`\`
```

#### `configuration/ai-settings.md`

Add section after "Flashcard Generation":

```markdown
## Knowledge Base (Pro)

Semantic search over your notes and flashcards. When enabled, True Recall indexes your vault content so AI assistants can find relevant information without reading every file.

This feature is available with a [Pro subscription](/pricing/).

Configure in `Settings → True Recall → Knowledge Base`:

| Setting | Description |
|---------|-------------|
| **Enable Knowledge Base** | Index your vault for semantic search. Default: **Off** |
| **Include folders** | Only index notes in these folders. Empty = all folders |
| **Exclude folders** | Skip notes in these folders. Default: `.true-recall`, `templates` |
| **Index flashcards** | Also index flashcard content. Default: **On** |
| **Auto-index** | Re-index when files change. Default: **On** |

See [Knowledge Base](/configuration/knowledge-base/) for full documentation.
```

#### `src/pages/pricing.astro`

Add to Pro features list:

```typescript
features: [
  "~5,000–7,000 flashcards per month",
  "Perfectly tuned prompts for learning",
  "Knowledge Base — semantic search over your notes",  // NEW
  "Language learning method coming soon",
  "No API key or setup needed",
  "Cancel anytime",
],
```

Add FAQ entry:

```typescript
{
  q: "What is the Knowledge Base?",
  a: "The Knowledge Base indexes your Obsidian notes and flashcards for semantic search. AI assistants like Claude Code can use it to find relevant information from your vault without reading every file. It also includes your flashcard mastery data, so the assistant knows what you've learned and what needs work."
}
```

#### `SITEMAP.md`

Add to Configuration section:
```
- `configuration/knowledge-base.md` — Knowledge Base: semantic search over notes and flashcards, indexing, MCP integration (Pro only)
```

### Pages That DON'T Need Changes

- `getting-started/*` -- not a beginner feature
- `review/*` -- RAG doesn't affect review flow (yet)
- `creation/*` -- RAG doesn't change flashcard creation (yet)
- `scheduling/*` -- unrelated
- `data/*` -- unrelated (RAG data is in the same SQLite db, backed up automatically)
- `views/*` -- no UI component for RAG (yet)

---

## Architecture

### Approach

**Zero new npm dependencies.** Embeddings via OpenRouter `/api/v1/embeddings` (BGE-M3, $0.01/MTok). Vectors stored as BLOBs in existing SQLite. Hybrid search: FTS5 keyword + cosine similarity + Reciprocal Rank Fusion. Heading-aware chunking adapted from existing `markdown-chunker.ts`. **MCP-first** -- agents are the primary consumer, not plugin UI.

### Database Schema (v19 migration)

New file: `src/features/rag/persistence/rag-schema.ts`
Called from `SqliteSchemaManager.createTables()`.

```sql
CREATE TABLE IF NOT EXISTS rag_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,          -- 'note' | 'flashcard'
    source_id TEXT NOT NULL,            -- file path (note) or card ID (flashcard)
    chunk_index INTEGER NOT NULL,       -- order within source
    content TEXT NOT NULL,              -- chunk text
    heading_breadcrumb TEXT DEFAULT '', -- "H1 > H2 > H3"
    token_count INTEGER DEFAULT 0,
    content_hash TEXT NOT NULL,         -- SHA-256 of content
    embedding BLOB,                    -- Float32Array as bytes (1024 dims = 4096 bytes)
    created_at INTEGER NOT NULL,
    UNIQUE(source_type, source_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON rag_chunks(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedded ON rag_chunks(embedding IS NOT NULL);

CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
    content, heading_breadcrumb,
    content='rag_chunks', content_rowid='id'
);

-- FTS sync triggers (same pattern as notes_fts)
CREATE TRIGGER IF NOT EXISTS rag_chunks_ai AFTER INSERT ON rag_chunks BEGIN
    INSERT INTO rag_chunks_fts(rowid, content, heading_breadcrumb)
    VALUES (new.id, new.content, new.heading_breadcrumb);
END;
CREATE TRIGGER IF NOT EXISTS rag_chunks_ad AFTER DELETE ON rag_chunks BEGIN
    INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content, heading_breadcrumb)
    VALUES('delete', old.id, old.content, old.heading_breadcrumb);
END;
CREATE TRIGGER IF NOT EXISTS rag_chunks_au AFTER UPDATE ON rag_chunks BEGIN
    INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content, heading_breadcrumb)
    VALUES('delete', old.id, old.content, old.heading_breadcrumb);
    INSERT INTO rag_chunks_fts(rowid, content, heading_breadcrumb)
    VALUES (new.id, new.content, new.heading_breadcrumb);
END;

CREATE TABLE IF NOT EXISTS rag_index_meta (
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    mtime INTEGER NOT NULL,
    chunk_count INTEGER DEFAULT 0,
    indexed_at INTEGER NOT NULL,
    PRIMARY KEY(source_type, source_id)
);
```

### File Structure

```
src/features/rag/
├── services/
│   ├── rag-chunker.service.ts       -- Heading-aware markdown splitting (~400 tokens)
│   ├── rag-embedding.service.ts     -- OpenRouter/LiteLLM embeddings API client
│   ├── rag-indexer.service.ts       -- Orchestrator: vault events -> chunk -> embed -> store
│   ├── rag-search.service.ts        -- Hybrid search: FTS5 + cosine + RRF + FSRS enrichment
│   ├── rag-query.service.ts         -- Search + context packing + LLM call (for sidebar chat)
│   └── rag-chat.service.ts          -- Conversation history, streaming, message management
├── persistence/
│   ├── rag-schema.ts                -- DDL for new tables
│   └── rag-chunk-actions.ts         -- CRUD for rag_chunks + rag_index_meta
├── ui/
│   ├── KnowledgeChatView.tsx        -- Obsidian ItemView sidebar (chat interface)
│   └── components/
│       ├── ChatMessage.tsx           -- Single message bubble (user/assistant)
│       ��── ChatInput.tsx             -- Text input with send button
│       ├── SourceChip.tsx            -- Clickable source note/flashcard badge
│       └── IndexStatus.tsx           -- Index status indicator
└── index.ts                         -- Barrel exports
```

MCP tools: `mcp-server/tools/rag-tools.ts`
API handlers: `src/plugin/api/handlers/rag.ts`

Additional service for sidebar chat:
- `rag-query.service.ts` -- search + pack context + call LLM for the sidebar chat UI
- `rag-chat.service.ts` -- manages conversation history, streaming responses

UI directory:
- `ui/KnowledgeChatView.tsx` -- Obsidian ItemView sidebar with chat interface
- `ui/components/` -- ChatMessage, ChatInput, SourceChip, etc.

### Service Design

#### RagChunkerService (`rag-chunker.service.ts`)

Adapts existing `markdown-chunker.ts` logic, targets **~400 tokens** per chunk.

```typescript
interface RagChunk {
  content: string;
  headingBreadcrumb: string;
  index: number;
  tokenCount: number;
}

chunkNote(content: string): RagChunk[]
  // 1. filterContent(raw) -- reuse from markdown-chunker.ts
  // 2. Split by headings (H1->H2->H3)
  // 3. If section > 400 tokens, split by paragraphs with 50-token overlap
  // 4. Keep code blocks and LaTeX intact
  // 5. Resolve [[wikilinks]] to full note names

chunkFlashcard(fieldsJson: string, sourceText?: string): RagChunk[]
  // Single chunk combining Q/A/source text
```

Reuses: `filterContent()` from `src/features/ai/services/markdown-chunker.ts`.

#### RagEmbeddingService (`rag-embedding.service.ts`)

Calls OpenRouter `/api/v1/embeddings` using `requestUrl()`.

```typescript
class RagEmbeddingService {
  constructor(private apiKey: string, private model: string = 'baai/bge-m3')

  async embed(texts: string[]): Promise<Float32Array[]>
    // POST to https://openrouter.ai/api/v1/embeddings
    // Headers: buildOpenRouterHeaders() from openrouter-client.ts
    // Batch max 64 texts per call
    // Retry on 429 with exponential backoff

  async embedSingle(text: string): Promise<Float32Array>
}
```

#### RagIndexerService (`rag-indexer.service.ts`)

Orchestrator. Indexes notes from vault + flashcards from SQLite.

```typescript
class RagIndexerService {
  constructor(
    private app: App,
    private db: SqliteDatabase,
    private chunker: RagChunkerService,
    private embedder: RagEmbeddingService,
    private settings: () => TrueRecallSettings
  )

  async fullReindex(): Promise<{ indexed: number; skipped: number; errors: number }>
    // 1. vault.getMarkdownFiles() -> filter by include/exclude
    // 2. For each: compare content_hash -> skip if unchanged
    // 3. Re-chunk changed files, batch-embed (64 per API call)
    // 4. Index flashcards from SQLite if ragIndexFlashcards=true
    // 5. Yield every 20 files (await sleep(0))

  async indexFile(file: TFile): Promise<void>
  async removeSource(sourceType: string, sourceId: string): Promise<void>

  registerVaultEvents(plugin: Plugin): void
    // vault.on('modify') -> debounce 5s -> indexFile
    // vault.on('delete') -> removeSource
    // vault.on('rename') -> removeSource(old) + indexFile(new)

  private shouldIndex(file: TFile): boolean
    // include/exclude folder patterns
```

Content hash: `crypto.subtle.digest('SHA-256', ...)` (Web Crypto API).

#### RagSearchService (`rag-search.service.ts`)

Hybrid search. Returns chunks **enriched with FSRS data** when source is a flashcard.

```typescript
interface SearchResult {
  chunkId: number;
  content: string;
  headingBreadcrumb: string;
  sourceType: 'note' | 'flashcard';
  sourceId: string;
  sourceNoteName?: string;        // resolved note name
  score: number;                  // RRF combined score
  tokenCount: number;
  // FSRS data (only for flashcard chunks)
  fsrs?: {
    state: number;                // 0=New, 1=Learning, 2=Review, 3=Relearning
    stability: number;
    difficulty: number;
    lapses: number;
    reps: number;
    lastReview?: string;
    due: string;
  };
}

class RagSearchService {
  constructor(private db: SqliteDatabase, private embedder: RagEmbeddingService)

  async search(query: string, topK?: number): Promise<SearchResult[]>
    // 1. FTS5 keyword search -> ranked results
    // 2. Embed query -> cosine scan all chunks -> top matches
    // 3. RRF merge (k=60)
    // 4. Enrich flashcard results with FSRS data from cards table
    // 5. Resolve note paths to note names
}
```

**Key design**: Flashcard search results include FSRS state, so agents can say "you have 8 flashcards about GABA, 3 problematic" without a separate SQL query.

Cosine similarity: ~10ms for 50K chunks. Embeddings lazy-loaded into memory on first search.

### Settings

New fields in `TrueRecallSettings`:

```typescript
ragEnabled: boolean;               // default: false
ragEmbeddingModel: string;         // default: 'baai/bge-m3'
ragIncludeFolders: string[];       // default: [] (empty = all)
ragExcludeFolders: string[];       // default: ['.true-recall', 'templates']
ragIndexFlashcards: boolean;       // default: true
ragAutoIndex: boolean;             // default: true
ragChunkMaxTokens: number;         // default: 400
```

Minimal settings tab: "Knowledge Base" -- enable toggle, folder patterns, embedding model, "Reindex now" button.

### MCP Tools (Primary Interface)

`mcp-server/tools/rag-tools.ts`

#### `search_knowledge`
The main tool. Agent calls this to find relevant notes + flashcards for any topic.

```typescript
params: {
  query: string,
  topK?: number,              // default 20
  sourceType?: 'note' | 'flashcard' | 'all'
}
returns: {
  results: SearchResult[],     // chunks with content, scores, FSRS data
  stats: {
    totalChunksSearched: number,
    notesMatched: number,
    flashcardsMatched: number,
    flashcardsByState: { new: number, learning: number, review: number, relearning: number }
  }
}
```

The `stats` block gives the agent an instant overview without counting manually.

#### `get_knowledge_status`
Index health and stats.

#### `index_knowledge`
Trigger reindex (full or incremental).

MCP server instructions update so agents know to use `search_knowledge` first when discussing topics.

### Local API Routes

`src/plugin/api/handlers/rag.ts` -- 3 routes:

| Method | Route | Maps to |
|--------|-------|---------|
| POST | `/rag/search` | RagSearchService.search() |
| POST | `/rag/index` | RagIndexerService.fullReindex() |
| GET | `/rag/status` | Index stats |

No `/rag/query` for MCP -- LLM answer generation is the agent's job, not the plugin's.
But `/rag/chat` exists for the sidebar chat feature (see below).

### Sidebar Chat View (Pro Feature)

An Obsidian sidebar view where the user can chat with their knowledge base. Opens via command palette: "True Recall: Chat with knowledge base".

#### Architecture

```
KnowledgeChatView (ItemView)
  └── Preact app mounted in sidebar
      ├── ChatInput (text input + send)
      ├── ChatMessage[] (scrollable message list)
      │   ├── User messages
      │   └── Assistant messages (streaming, with source chips)
      └── IndexStatus (bottom bar: "1,234 chunks indexed")
```

**KnowledgeChatView** extends Obsidian `ItemView`:
- View type: `true-recall-knowledge-chat`
- Registered in `main.ts` alongside existing views (dashboard, stats, etc.)
- Follows existing pattern from `src/plugin/views/` (e.g., DashboardView, StatsView)
- Mounts Preact component, manages lifecycle, disposes on close

#### Chat Flow

```
User types question
  → RagQueryService.query(question, conversationHistory)
    → RagSearchService.search(question)  // get relevant chunks
    → Pack chunks into context (token budget ~4000)
    → Build messages array:
        System: "You are an assistant that answers based on the user's notes and flashcards.
                 Cite sources using [Source: filename > heading].
                 For flashcard results, mention mastery level (stable, learning, struggling).
                 If context doesn't contain enough info, say so clearly."
        ...conversationHistory (previous turns)
        User: "[RAG context chunks]\n\nQuestion: {question}"
    → StreamingOpenRouterClient.chat(messages)  // streaming response
    → Stream tokens to UI
  → Show assistant message with source chips (clickable → open note)
```

#### RagQueryService (`rag-query.service.ts`)

```typescript
class RagQueryService {
  constructor(
    private search: RagSearchService,
    private settings: () => TrueRecallSettings
  )

  async *queryStream(
    question: string,
    history: ChatMessage[],
    tokenBudget?: number
  ): AsyncGenerator<string>
    // 1. search.search(question, topK=20)
    // 2. Greedily pack chunks into token budget (default 4000)
    // 3. Build conversation messages with RAG context
    // 4. Stream via StreamingOpenRouterClient (reuse existing)
    // 5. Yield tokens as they arrive

  async query(question: string, history: ChatMessage[]): Promise<{
    answer: string;
    sources: SearchResult[];
  }>
    // Non-streaming version for API use
}
```

#### RagChatService (`rag-chat.service.ts`)

```typescript
interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  sources?: SearchResult[];    // sources used for this response
  timestamp: number;
}

class RagChatService {
  private history: ChatTurn[] = [];

  async sendMessage(message: string): AsyncGenerator<string>
    // 1. Add user turn to history
    // 2. Call ragQuery.queryStream(message, history)
    // 3. Collect streamed response
    // 4. Add assistant turn to history with sources
    // 5. Yield tokens for UI

  clearHistory(): void
  getHistory(): ChatTurn[]
}
```

#### UI Components

**ChatMessage.tsx**: Renders a single message. Assistant messages show:
- Markdown-rendered text (reuse Obsidian's MarkdownRenderer)
- Source chips below the message (clickable, open in Obsidian)
- Flashcard sources show FSRS state badge (New/Learning/Review/Relearning)

**ChatInput.tsx**: Text input with:
- Multiline support (Shift+Enter for newline, Enter to send)
- Send button
- Disabled state during streaming

**SourceChip.tsx**: Small clickable badge showing:
- Note icon + note name (for note sources)
- Card icon + truncated question (for flashcard sources)
- FSRS state color badge (for flashcards)
- Click: `app.workspace.openLinkText(path)`

**IndexStatus.tsx**: Bottom bar:
- "1,234 chunks indexed" or "Not indexed yet"
- "Reindex" button
- Last indexed timestamp

#### Additional API Route

| Method | Route | Maps to |
|--------|-------|---------|
| POST | `/rag/chat` | RagQueryService.query() (non-streaming, for external tools) |

#### Additional Settings

```typescript
ragChatModel?: string;  // Override model for chat (defaults to user's aiModel)
```

---

## Comprehensive Repository Findings

### true-recall-proxy -- Full Analysis

#### Infrastructure
- **Stack**: LiteLLM proxy + PostgreSQL 16 + Cloudflare Tunnel
- **Deployed on**: ZimaBlade (`ssh zimablade`), path: `/home/lucas/docker/true-recall-proxy/`
- **Public URL**: `https://ai.truerecall.app` (via Cloudflare Tunnel)
- **Docker**: 3 services -- `db` (postgres:16-alpine), `proxy` (custom LiteLLM image), `cloudflared`
- **Port**: 4000 (internal only, exposed through Cloudflare)
- **Alternative**: Fly.io config exists (`fly.toml`, `fra` region, shared-cpu-1x, 2GB RAM)

#### LiteLLM Configuration (`litellm_config.yaml`)
```yaml
model_list:
  - model_name: "auto"
    litellm_params:
      model: "openrouter/google/gemini-2.5-flash"
      api_key: "os.environ/OPENROUTER_API_KEY"
      timeout: 60
      max_retries: 2

general_settings:
  master_key: "os.environ/LITELLM_MASTER_KEY"
  database_url: "os.environ/DATABASE_URL"
  max_budget: 20

litellm_settings:
  callbacks: custom_callbacks.proxy_handler_instance
  drop_params: true
  request_timeout: 60
  set_verbose: false
  num_retries: 2
```

**Key**: Only ONE model configured (chat). No embedding model. `drop_params: true` means unsupported params are silently dropped.

#### Custom Callbacks (`custom_callbacks.py`)
- **Class**: `ModelRouterHandler(CustomLogger)` with `async_pre_call_hook`
- **Model routing**: Reads `target_model` from key metadata or team metadata → overrides `data["model"]`
- **Prompt injection**: Server-side prompts from PostgreSQL `prompt_templates` table:
  - `generation` context → prepends `generation_rules` to system message
  - `grading` context → replaces system message with `type_in_grading`
- **Temperature defaults**: `generation: 0.7`, `grading: 0` (only if client doesn't send temperature)
- **PromptCache**: In-memory cache with 5-min TTL, auto-bootstraps from `init.sql`
- **For embeddings**: `call_type = "embedding"` → `call_context` will be absent → skips prompt injection entirely. No changes needed.

#### Environment Variables
| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Upstream API access |
| `LITELLM_MASTER_KEY` | Admin API key (must start with `sk-`) |
| `LITELLM_SALT_KEY` | Encryption salt for stored keys (**never change after setup**) |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_SECRET` | Shared secret for admin Edge Functions |

#### Teams & Budget System
| Team | ID | Budget |
|------|-----|--------|
| admins | `30cd10a5-cd61-4fc4-b965-0b341868ef08` | Unlimited |
| beta-testers | `2410c0d1-96c0-4349-8ea0-5d4cb73dcd6a` | $1/key one-time |
| users | `816f5a9c-87d5-4753-8e6f-311a07e6e8b0` | Trial + Pro |

**Plan types**:
- Free Trial: $0.25 budget, no reset, no expiry
- Pro: $4/month, auto-resets (`budget_duration: 30d`)
- Suspended: `max_budget = 0`
- Expired: key past expiry timestamp

Budget tracking is automatic via `LiteLLM_SpendLogs` table.

#### Scripts
| Script | Purpose |
|--------|---------|
| `scripts/upgrade-to-pro.sh <email> [budget]` | Upgrade trial → Pro ($4/mo default) via direct SQL |
| `scripts/create-user.sh` | Create Supabase user via Edge Function |
| `scripts/list_keys.py` | List all keys in a team with spend/budget info |
| `scripts/logs.sh` | Quick analytics: `activity`, `daily`, `users`, `live` |

#### Database
- **LiteLLM tables** (auto-created): `LiteLLM_VerificationToken` (keys), `LiteLLM_SpendLogs` (requests), `LiteLLM_ProxyUser`
- **Custom tables**: `prompt_templates` (server-side prompts, 2 entries: `generation_rules`, `type_in_grading`)
- **Analytics views**: `user_activity`, `daily_user_summary`, `user_stats`, `user_stats_live`
- **Grafana dashboard**: `dashboard-true-recall.json` with panels for requests/time, spend, success rate, tokens, unique users

#### Supabase Edge Functions (6 functions)
| Function | Purpose |
|----------|---------|
| `provision-trial-key` | Auto-provision $0.25 trial on first dashboard visit |
| `polar-webhook` | Subscription lifecycle: created, updated, cancelled, revoked |
| `admin-create-user` | Admin user creation with LiteLLM key |
| `create-portal-session` | Polar customer portal URL |
| `get-subscription-status` | Read user's plan/status/key |
| `cleanup-expired` | Cron: delete keys for expired cancelled subscriptions |

**Polar webhook flow**:
1. `subscription.created/active` → generate LiteLLM key ($4/mo, 30d reset) or upgrade existing
2. `subscription.canceled` → set key expiry to `current_period_end`
3. `subscription.revoked` → block key (`max_budget = 0`)

#### Dockerfile
- Base: `docker.litellm.ai/berriai/litellm:main-latest`
- Installs `asyncpg` for PostgreSQL async client
- Copies: config, callbacks, init.sql
- Healthcheck: `GET /health/liveliness` every 30s
- Port 4000

---

### true-recall (plugin) -- Relevant Codebase Findings

#### AI Layer (src/features/ai/)
- **OpenRouterClient** (`openrouter-client.ts`): HTTP client using `requestUrl()` (Obsidian's CORS-free HTTP). Builds headers with `buildOpenRouterHeaders(apiKey)`. Throws `AIRequestError` with status codes (429 rate limit, 401 unauthorized).
- **StreamingOpenRouterClient** (`streaming-openrouter-client.ts`): SSE streaming via `fetch()` + `ReadableStreamDefaultReader`. Async generator. Handles `AbortSignal` cleanup. Used for flashcard generation streaming -- **reusable for sidebar chat streaming**.
- **AI Client Config** (`ai-client-config.ts`): Resolves Pro (LiteLLM `https://ai.truerecall.app/v1/chat/completions`) vs BYOK (OpenRouter direct). Pro tier uses `proKey`, BYOK uses `openRouterApiKey`. Temperature defaults per model.
- **Supported models** (`constants.ts`): `google/gemini-2.5-pro-preview`, `google/gemini-2.5-flash` (recommended), `deepseek/deepseek-r1`, `anthropic/claude-sonnet-4`, `openai/o4-mini`.
- **Markdown Chunker** (`markdown-chunker.ts`): `filterContent()` strips frontmatter/code blocks/comments/images. `chunkMarkdown()` does heading-aware splitting at 3000 words. **Key reuse**: `filterContent()` and heading detection logic for RAG chunker (but at 400 tokens, not 3000 words).

#### Vault Access Patterns
- **FrontmatterIndexService** (`src/features/core/services/frontmatter-index.service.ts`): In-memory index of frontmatter fields with O(1) lookups. Registered fields: `flashcard_uid` (unique), `fsrs_preset` (array), `parents` (array), `include`, `archive`.
  - `rebuildIndex()` on plugin load when `metadataCache` ready
  - `getFileByValue(field, value)` → O(1) TFile lookup
  - `getFilesByValue(field, value)` → all files with value
  - Events: `metadataCache.on("changed")`, `vault.on("delete")`, `vault.on("rename")`
  - **RAG indexer should use similar vault event patterns** but listen to `vault.on("modify")` too for content changes.
- **SourceNoteService** (`src/features/study/services/flashcard/source-note.service.ts`): Resolves `sourceUid` → file path via FrontmatterIndex. `enrichCard()` / `enrichCards()` adds `sourceNoteName` / `sourceNotePath`.

#### Database Layer
- **SqliteDatabase** (`src/features/core/persistence/sqlite/SqliteDatabase.ts`): Type-safe wrapper over sql.js WASM. Methods: `query<T>(sql, params): T[]`, `get<T>(): T | null`, `run()`, `transaction()`, `changes()`.
- **Schema v18** (`SqliteSchemaManager.ts`): Tables: `note_types`, `notes` (with `fields_json`, `source_uid`, `source_text`), `cards` (FSRS: due, stability, difficulty, reps, lapses, state, suspended, buried_until), `review_log`, `daily_stats`, `meta`. FTS5 virtual table `notes_fts` on `fields_json`.
- **Module pattern** (`modules/CardActions.ts`, `NoteActions.ts`, etc.): Classes taking `SqliteDatabase` with typed CRUD methods. **`RagChunkActions` should follow this exact pattern**.
- **FTS5 trigger pattern**: Already proven with `notes_fts`. Same trigger approach for `rag_chunks_fts`.

#### Local API Server
- **LocalApiServer** (`src/plugin/api/LocalApiServer.ts`): Node.js `createServer()` on port 27182. Auto-retry on `EADDRINUSE` (up to 5 ports). CORS `*`. Started in `main.ts` if `settings.enableLocalApi`.
- **Routes** (`src/plugin/api/routes.ts`): 51 routes, dispatcher pattern. Each handler is a function `(req, services) => Response`.
- **Handler pattern** (`handlers/*.ts`): Export functions registered in `routes.ts`. Response format: `{ ok: true, data }` or `{ ok: false, error }`.

#### MCP Server
- **Client** (`mcp-server/client.ts`): `TrueRecallClient` class -- HTTP bridge to Local API. Methods: `get(path)`, `post(path, body)`.
- **Tool registration** (`mcp-server/tools/*.ts`): `registerXTools(server: McpServer, client: TrueRecallClient)` pattern. Uses Zod schemas for input validation.
- **12 tool files**: backup, card, context, dashboard, fsrs, generate, navigation, note, query, review, session, stats.
- **Server instructions** in `mcp-server/index.ts` -- tells agents how to use tools (e.g., "call get_full_context FIRST").

#### Reactive System
- **Signals** (`src/shared/services/signals.ts`): `dataVersion`, `lastMutation`, `settingsVersion`, `syncVersion`. `notifyCardChange()` after mutations. `effect()` + `track()` for consumers.
- **Reactive Card Store** (`src/shared/services/reactive-card-store.ts`): Computed signals: `allCardsArray`, `globalCounts`, `cardsBySourceUid`, `noteStatusMap`. RAG indexer should listen to `dataVersion` signal to know when flashcard content changes.

#### Existing Search
- **Card Browser search** (`src/features/library/ui/browser/helpers/search-parser.ts`): Query grammar: `is:new`, `prop:s>21`, `note:"Biology"`, `type:basic`, `via:ai`, `added:7`, `"exact phrase"`. FTS5 used for text search.
- **SQL Query Adapter** (`src/features/ai/services/sql-query.adapter.ts`): NL→SQL bridge. `getTableInfo()` returns full schema with FSRS annotations. Used by MCP `query_sql` tool.

#### Views Pattern
- **ItemView subclasses** in `src/plugin/views/`: DashboardView, StatsView, CardBrowserView, etc. Each extends `ItemView`, mounts Preact component in `onOpen()`, disposes in `onClose()`. **KnowledgeChatView should follow this pattern exactly**.
- **View types** registered in `main.ts` via `this.registerView(VIEW_TYPE, (leaf) => new XView(leaf, ...))`.

---

### true-recall-docs -- Full Analysis

#### Site Architecture
- **Framework**: Astro 5 + Starlight + `starlight-theme-obsidian`
- **Output**: Static site, deployed to Vercel
- **URL**: https://truerecall.app
- **Content path**: `src/content/docs/` (.md/.mdx)
- **Special pages**: `src/pages/` (login, dashboard, pricing, privacy, terms)
- **Accent color**: `#7c3aed`

#### Sidebar Structure (8 sections, 41 pages)
1. **Getting Started** (5): why-true-recall, introduction, installation, quick-start, basic-concepts
2. **Creation** (7): creating-flashcards, note-types, cloze-deletions, image-occlusion, custom-note-types, best-practices, projects-and-notes
3. **Review** (5): review-interface, answering-cards, type-in-mode, cramming, leeches
4. **Views** (8): dashboard, selection-toolbar, flashcard-panel, flashcard-editor, card-browser, import-studio, statistics (+ 1 stub)
5. **Configuration** (5): general, fsrs-settings, ai-settings, editor-integration, keyboard-shortcuts
6. **Scheduling** (4): fsrs-algorithm, overview, presets, workload-management
7. **Data** (4): backup-restore, device-databases, integrity-check, import-export
8. **Reference** (3): frontmatter-fields, mcp-server, troubleshooting

#### Pricing Page (`src/pages/pricing.astro`)
Three tiers:
- **Free Trial**: $0, ~350-700 cards one-time, no card required
- **Pro**: $8/month, ~5,000-7,000 cards/month, tuned prompts, language learning coming soon
- **BYOK**: Free forever, bring your own OpenRouter API key

7 FAQ entries covering: card counts, Pro vs BYOK, own API key, running out, cancellation, activation, trial

#### AI Settings Page (`configuration/ai-settings.md`)
Sections: Subscription Key (Pro), OpenRouter API Key (BYOK), AI Prompts, Flashcard Generation, Generation Prompt, What to Read Next

#### MCP Server Reference (`reference/mcp-server.md`)
- 34 tools in 11 groups
- Setup: enable Local API + configure `.mcp.json` + `bun install`
- 4 example workflows: create cards, review in terminal, study analytics, problem areas
- Configuration: custom port, security (localhost only)
- Troubleshooting table

#### Writing Guidelines (from CLAUDE.md)
- `description` field required on every page (SEO)
- `:::caution[My Notes]` for dev-only notes (stripped in production by remark plugin)
- End with "What to Read Next" (3-5 links)
- `TODO PHOTO` marks for screenshots
- **Bold** for UI elements, `backticks` for code
- Bidirectional linking, descriptive link text
- Short paragraphs (3-4 sentences max)
- Asides: `:::note`, `:::tip`, `:::caution` (max 2-3 per page)
- Terminology: True Recall (bold), card states capitalized, FSRS (no expansion after Basic Concepts)
- Settings paths: `Settings → Section → "Option Name"`

#### Component Overrides
- `Header.astro` -- custom header layout
- `Head.astro` -- Vercel Analytics injection
- `Hero.astro` -- custom landing hero

#### Remark Plugin
`plugins/remark-strip-dev-notes.mjs` strips `:::caution[My Notes]` in production builds.

#### Sidebar Label Convention
- `(P)` suffix = needs photos/screenshots
- No suffix = not yet reviewed

---

## Trade-offs & Design Decisions

### 1. Cloud embeddings vs Local embeddings

**Chose: Cloud (OpenRouter)**
- Pro: Zero bundle size increase, higher quality models, multilingual, no CPU load
- Con: Requires API key + internet, costs money (tiny), privacy concern for sensitive notes
- Future: Could add local embedding option (Transformers.js) as opt-in for privacy-focused users

### 2. SQLite BLOBs vs Separate vector DB

**Chose: SQLite BLOBs**
- Pro: Single db file, atomic with card data, zero deps, already have sql.js
- Con: O(n) search, no ANN indexing, memory pressure with large vaults
- Mitigation: Lazy-load embeddings, evict on memory pressure
- Future: sqlite-vec extension if perf becomes an issue (requires custom WASM build)

### 3. FTS5 + Cosine + RRF vs Orama hybrid

**Chose: FTS5 + Cosine + RRF**
- Pro: FTS5 already in our WASM binary, RRF is simple and effective, zero new deps
- Con: Manual implementation, no built-in faceting
- Alternative: Orama gives hybrid search out-of-box but adds a dependency and second data store

### 4. 400-token chunks vs Larger chunks

**Chose: ~400 tokens**
- Pro: Better granularity for search, more chunks fit in context budget
- Con: More chunks = more embeddings = slightly higher cost, may split related content
- Overlap of 50 tokens mitigates boundary splitting

### 5. Embedding dimensions

**BGE-M3 default: 1024 dims = 4KB per chunk**
- 10K chunks = 40MB in db, 40MB in memory during search
- 50K chunks = 200MB in db, 200MB in memory
- Could use MRL truncation (256 or 512 dims) for less memory
- Trade-off: lower dims = slightly lower quality but much less memory

### 6. Real-time indexing vs Manual trigger

**Chose: Both** (auto-index on vault changes + manual trigger)
- Auto-index: debounced 5s after file modify
- Manual trigger: MCP tool + API endpoint for full reindex
- Toggle in settings: `ragAutoIndex`

### 7. Embedding cache invalidation

- Content hash (SHA-256) per source file
- Only re-chunk + re-embed if content hash changed
- File mtime as fast pre-check (skip hash if mtime unchanged)
- On model change: full reindex required (different model = incompatible embeddings)

### 8. Memory management for vector search

- **Lazy load**: Only load on first search, not on plugin start
- **LRU eviction**: If memory pressure detected, drop the cache
- **Chunked loading**: Load in batches of 1000 to avoid blocking event loop

### 9. No RagQueryService (MCP-first)

**Chose: No LLM answer generation in plugin**
- The agent calling MCP already IS the LLM -- it gets chunks + FSRS data and conducts conversation
- Avoids double LLM call (plugin generates answer -> agent reads answer)
- Plugin's job: index, search, return data. Agent's job: reason about it.
- If plugin UI is added later, RagQueryService can be added then

### 10. FSRS enrichment in search results

**Chose: Include FSRS data in flashcard search results**
- Agent can say "you have 8 flashcards about GABA, 3 problematic" without separate SQL query
- Adds marginal overhead (JOIN with cards table) but huge value for agent context
- Note chunks don't have FSRS data (they're not flashcards)

---

## Brainstorming Notes (from discussion)

### What this feature is about
- **Not** a search tool, **not** a report generator
- Infrastructure for agents to be **context-aware** about user's knowledge
- User's vault = personal knowledge base for grounding agents (anti-hallucination)
- Notes without flashcards ≠ knowledge gap. Could be reference, "for later", or well-known topic
- Flashcards = things that are hard, need understanding, need memorization

### Rejected ideas
- **Structured knowledge audit report** -- too rigid, user wants conversation not reports
- **"What you know / don't know" classification** -- can't determine from data alone, need conversation
- **Plugin UI as primary interface** -- agents are the real consumer, UI is secondary
- **RagQueryService** -- unnecessary double LLM call when agent IS the LLM

### Future ideas (post-MVP)
1. Plugin UI (sidebar view, not modal) if direct search proves useful
2. Query expansion: LLM generates related terms before search
3. Re-ranking: cross-encoder for more precise ranking
4. Note suggestions: "Related notes" sidebar based on embedding similarity
5. Flashcard context: during review, show related note excerpts
6. Auto-tagging: cluster embeddings to suggest tags
7. Local embeddings (Transformers.js) for privacy
8. Graph-aware search: boost notes connected via wikilinks
9. Knowledge clustering / topic maps

---

## Key Files to Modify

| File | Change |
|------|--------|
| `src/features/core/persistence/sqlite/SqliteSchemaManager.ts` | Call `RagSchemaManager.createTables()` |
| `src/shared/types/settings.types.ts` | Add 7 RAG settings fields |
| `src/shared/constants.ts` | Add RAG defaults + embedding model list |
| `src/main.ts` | Instantiate RAG services, register vault events |
| `src/plugin/api/routes.ts` | Register 3 RAG routes |
| `mcp-server/index.ts` | Import and register RAG tools |
| `src/features/settings/SettingsApp.tsx` | Add "Knowledge Base" tab |

## Key Files to Reuse

| File | What to reuse |
|------|---------------|
| `src/features/ai/services/markdown-chunker.ts` | `filterContent()`, heading detection, breadcrumb building |
| `src/features/ai/services/openrouter-client.ts` | `buildOpenRouterHeaders()`, `AIRequestError`, `requestUrl()` pattern |
| `src/features/core/persistence/sqlite/modules/CardActions.ts` | Pattern for `RagChunkActions` |
| `src/features/core/services/frontmatter-index.service.ts` | Vault event patterns, file filtering |
| `mcp-server/tools/query-tools.ts` | MCP tool registration pattern |

---

## Implementation Phases

### Phase 0: Proxy (true-recall-proxy)
- Add embedding model entry to `litellm_config.yaml`
- Deploy to ZimaBlade: edit config + `docker compose restart proxy`
- Verify with curl test against `ai.truerecall.app/v1/embeddings`

### Phase 1: Foundation (plugin -- persistence + chunking)
- `rag-schema.ts` -- create tables, integrate into `SqliteSchemaManager`
- `rag-chunk-actions.ts` -- CRUD operations
- `rag-chunker.service.ts` -- heading-aware splitting at 400 tokens
- Tests for chunking logic

### Phase 2: Embedding + Indexing (plugin)
- `rag-embedding.service.ts` -- calls Pro proxy `/v1/embeddings` with `model: "embedding"`
- `rag-indexer.service.ts` -- full/incremental indexing pipeline
- Settings fields + `RagTab.tsx` (Pro-only gate: visible when `aiTier === "pro"`)
- Wire up in `main.ts`

### Phase 3: Search + MCP + API (plugin + mcp-server)
- `rag-search.service.ts` -- FTS5 + cosine + RRF + FSRS enrichment
- `src/plugin/api/handlers/rag.ts` -- 3 API routes (Pro-only gate)
- `mcp-server/tools/rag-tools.ts` -- 3 MCP tools (return "Pro required" for non-Pro)
- Register in `routes.ts` and MCP `index.ts`
- Update MCP server instructions
- Tests for search and RRF logic

### Phase 4: Sidebar Chat (plugin UI -- Pro only)
- `rag-query.service.ts` -- search + context packing + LLM streaming
- `rag-chat.service.ts` -- conversation history management
- `KnowledgeChatView.tsx` -- Obsidian ItemView sidebar
- UI components: ChatMessage, ChatInput, SourceChip, IndexStatus
- Register view in `main.ts`, add command "Chat with knowledge base"
- Streaming via existing `StreamingOpenRouterClient`

### Phase 5: Documentation (true-recall-docs)
- Create `configuration/knowledge-base.md` -- full KB documentation
- Update `reference/mcp-server.md` -- add Knowledge Base tools section + example workflow
- Update `configuration/ai-settings.md` -- add Knowledge Base subsection
- Update `src/pages/pricing.astro` -- add KB to Pro features + FAQ entry
- Update `SITEMAP.md`

---

## Verification

1. **Proxy**: `curl -X POST https://ai.truerecall.app/v1/embeddings -H "Authorization: Bearer $PRO_KEY" -d '{"model":"embedding","input":["test"]}'`
2. **Build**: `bun run build` after each plugin phase
3. **Unit tests**: Chunker (splitting), search (RRF math), embedding (mock API)
4. **Integration via MCP**:
   - Enable RAG in settings, trigger `index_knowledge`
   - `get_knowledge_status` -- verify chunks indexed
   - `search_knowledge("GABA receptors")` -- verify results include note chunks + flashcard chunks with FSRS data
   - In Claude Code: "co wiem o kofeinie?" -- agent uses `search_knowledge`, gets context, has informed conversation
5. **Pro gate**: Verify BYOK user gets "Pro subscription required" from MCP tools and API routes
6. **Incremental**: Modify a note, verify only that note re-indexes
7. **Performance**: 1000-note vault indexing time and cost
8. **Docs**: `npm run dev` in true-recall-docs, verify new/updated pages render correctly
