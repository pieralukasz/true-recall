import { __awaiter } from "tslib";
import { RAG_CONFIG } from "@true-recall/core/constants";
export class RagSearchService {
    constructor(actions, embedder) {
        this.actions = actions;
        this.embedder = embedder;
        this.embeddingCache = null;
    }
    search(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, topK = RAG_CONFIG.defaultTopK, sourceType, sourceIds) {
            var _a, _b;
            // Over-fetch when filtering so we still get topK results after filtering
            const isFiltered = (sourceType && sourceType !== "all") ||
                (sourceIds && sourceIds.length > 0);
            const fetchMultiplier = isFiltered ? 4 : 2;
            const fetchSize = topK * fetchMultiplier;
            const ftsResults = this.actions.searchFts(query, fetchSize);
            const queryEmbedding = yield this.embedder.embedSingle(query);
            const vectorResults = this.cosineSearch(queryEmbedding, fetchSize);
            // Track which chunks passed vector threshold — FTS-only results without
            // sufficient cosine similarity are noise
            const vectorPassedIds = new Set(vectorResults.map((r) => r.id));
            const merged = this.rrfMerge(ftsResults, vectorResults, fetchSize).filter((m) => vectorPassedIds.has(m.id));
            const chunkIds = merged.map((m) => m.id);
            const chunks = this.actions.getChunksByIds(chunkIds);
            const chunkMap = new Map(chunks.map((c) => [c.id, c]));
            const fsrsData = this.actions.getFsrsDataForChunks(chunkIds);
            const fsrsMap = new Map(fsrsData.map((f) => [f.card_id, f]));
            const mtimeMap = this.actions.getMtimeForChunks(chunkIds);
            const results = [];
            for (const m of merged) {
                const chunk = chunkMap.get(m.id);
                if (!chunk)
                    continue;
                if (sourceType &&
                    sourceType !== "all" &&
                    chunk.source_type !== sourceType)
                    continue;
                if (sourceIds &&
                    sourceIds.length > 0 &&
                    !sourceIds.includes(chunk.source_id))
                    continue;
                const result = {
                    chunkId: chunk.id,
                    content: chunk.content,
                    headingBreadcrumb: chunk.heading_breadcrumb,
                    sourceType: chunk.source_type,
                    sourceId: chunk.source_id,
                    score: m.score,
                    tokenCount: chunk.token_count,
                    modifiedAt: mtimeMap.get(chunk.id),
                };
                if (chunk.source_type === "flashcard") {
                    const fsrs = fsrsMap.get(chunk.source_id);
                    if (fsrs) {
                        result.sourceNoteUid = (_a = fsrs.source_uid) !== null && _a !== void 0 ? _a : undefined;
                        result.fsrs = {
                            state: fsrs.state,
                            stability: fsrs.stability,
                            difficulty: fsrs.difficulty,
                            lapses: fsrs.lapses,
                            reps: fsrs.reps,
                            lastReview: (_b = fsrs.last_review) !== null && _b !== void 0 ? _b : undefined,
                            due: fsrs.due,
                        };
                    }
                }
                results.push(result);
            }
            const stats = this.computeStats(results);
            return { results: results.slice(0, topK), stats };
        });
    }
    cosineSearch(queryEmbedding, topK) {
        this.ensureEmbeddingCache();
        if (!this.embeddingCache)
            return [];
        const scored = [];
        for (const [id, embedding] of this.embeddingCache) {
            const score = cosineSimilarity(queryEmbedding, embedding);
            if (score >= RAG_CONFIG.cosineThreshold) {
                scored.push({ id, score });
            }
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
    }
    ensureEmbeddingCache() {
        if (this.embeddingCache)
            return;
        const rows = this.actions.getAllEmbeddings();
        this.embeddingCache = new Map();
        for (const row of rows) {
            const float32 = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
            this.embeddingCache.set(row.id, float32);
        }
    }
    invalidateCache() {
        this.embeddingCache = null;
    }
    // Reciprocal Rank Fusion: merges FTS5 keyword and vector rankings. k=60 is the standard smoothing constant (Cormack et al. 2009).
    rrfMerge(ftsResults, vectorResults, topK) {
        var _a, _b;
        const k = RAG_CONFIG.rrf_k;
        const scores = new Map();
        for (let i = 0; i < ftsResults.length; i++) {
            const r = ftsResults[i];
            if (!r)
                continue;
            const current = (_a = scores.get(r.id)) !== null && _a !== void 0 ? _a : 0;
            scores.set(r.id, current + 1 / (k + i + 1));
        }
        for (let i = 0; i < vectorResults.length; i++) {
            const r = vectorResults[i];
            if (!r)
                continue;
            const current = (_b = scores.get(r.id)) !== null && _b !== void 0 ? _b : 0;
            scores.set(r.id, current + 1 / (k + i + 1));
        }
        return Array.from(scores.entries())
            .map(([id, score]) => ({ id, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }
    computeStats(results) {
        var _a, _b;
        const noteIds = new Set();
        const fcIds = new Set();
        const byState = { new: 0, learning: 0, review: 0, relearning: 0 };
        for (const r of results) {
            if (r.sourceType === "note")
                noteIds.add(r.sourceId);
            else {
                fcIds.add(r.sourceId);
                if (r.fsrs) {
                    const s = r.fsrs.state;
                    if (s === 0)
                        byState.new++;
                    else if (s === 1)
                        byState.learning++;
                    else if (s === 2)
                        byState.review++;
                    else if (s === 3)
                        byState.relearning++;
                }
            }
        }
        return {
            totalChunksSearched: (_b = (_a = this.embeddingCache) === null || _a === void 0 ? void 0 : _a.size) !== null && _b !== void 0 ? _b : 0,
            notesMatched: noteIds.size,
            flashcardsMatched: fcIds.size,
            flashcardsByState: byState,
        };
    }
}
function cosineSimilarity(a, b) {
    var _a, _b;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        const ai = (_a = a[i]) !== null && _a !== void 0 ? _a : 0;
        const bi = (_b = b[i]) !== null && _b !== void 0 ? _b : 0;
        dot += ai * bi;
        normA += ai * ai;
        normB += bi * bi;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
