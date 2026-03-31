import { __awaiter } from "tslib";
import { effect } from "@preact/signals-core";
import { RAG_CONFIG } from "@true-recall/core/constants";
import { chunkDailyNote, chunkFlashcard, chunkNote, } from "@true-recall/core/rag/ingestion/rag-chunker.service";
import { lastMutation } from "@true-recall/obsidian/services/signals";
import { debounce, TFile } from "obsidian";
import { detectDailyNote } from "./daily-note-detector";
function toUpsertChunks(chunks, hash) {
    return chunks.map((c) => ({
        content: c.content,
        headingBreadcrumb: c.headingBreadcrumb,
        tokenCount: c.tokenCount,
        contentHash: hash,
    }));
}
export class RagIndexerService {
    constructor(app, actions, embedder, settings) {
        this.app = app;
        this.actions = actions;
        this.embedder = embedder;
        this.settings = settings;
        this.searchService = null;
    }
    setSearchService(search) {
        this.searchService = search;
    }
    fullReindex(onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = {
                indexed: 0,
                skipped: 0,
                errors: 0,
                embedded: 0,
                embeddingTruncated: false,
                embeddingRemaining: 0,
                flashcardsIndexed: 0,
                flashcardsSkipped: 0,
            };
            const s = this.settings();
            const files = this.app.vault
                .getMarkdownFiles()
                .filter((f) => this.shouldIndex(f));
            const totalFiles = files.length;
            for (let i = 0; i < files.length; i++) {
                try {
                    const file = files[i];
                    if (!file)
                        continue;
                    const wasIndexed = yield this.indexFile(file);
                    if (wasIndexed)
                        result.indexed++;
                    else
                        result.skipped++;
                }
                catch (e) {
                    console.error("[True Recall RAG] Index error:", e);
                    result.errors++;
                }
                onProgress === null || onProgress === void 0 ? void 0 : onProgress({ phase: "notes", current: i + 1, total: totalFiles });
                // Yield every 20 files to not block the event loop
                if (i % 20 === 0)
                    yield new Promise((r) => setTimeout(r, 0));
            }
            if (s.ragIndexFlashcards) {
                const fcResult = yield this.indexFlashcards(onProgress);
                result.flashcardsIndexed = fcResult.indexed;
                result.flashcardsSkipped = fcResult.skipped;
                result.errors += fcResult.errors;
            }
            const embedResult = yield this.embedPending(onProgress);
            result.embedded = embedResult.embedded;
            result.embeddingTruncated = embedResult.truncated;
            result.embeddingRemaining = embedResult.remaining;
            return result;
        });
    }
    indexFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const content = yield this.app.vault.cachedRead(file);
            const hash = yield this.contentHash(content);
            const meta = this.actions.getIndexMeta("note", file.path);
            if (meta && meta.content_hash === hash)
                return false;
            const s = this.settings();
            const dailyInfo = detectDailyNote(this.app, file, s.ragDailyNotesFolder || undefined);
            const chunks = dailyInfo.isDailyNote && dailyInfo.date
                ? chunkDailyNote(content, dailyInfo, s.ragDailyNoteExcludeHeadings)
                : chunkNote(content);
            this.actions.upsertChunks("note", file.path, toUpsertChunks(chunks, hash));
            this.actions.upsertIndexMeta("note", file.path, hash, file.stat.mtime, chunks.length);
            return true;
        });
    }
    removeSource(sourceType, sourceId) {
        this.actions.deleteBySource(sourceType, sourceId);
        this.actions.deleteIndexMeta(sourceType, sourceId);
    }
    registerCardSignals(plugin) {
        const debouncedCardIndex = debounce((cardIds) => __awaiter(this, void 0, void 0, function* () {
            const s = this.settings();
            if (!s.ragEnabled || !s.ragAutoIndex || !s.ragIndexFlashcards)
                return;
            try {
                for (const id of cardIds) {
                    yield this.indexSingleCard(id);
                }
                yield this.embedPending();
            }
            catch (e) {
                console.error("[True Recall RAG] Auto-index card error:", e);
            }
        }), RAG_CONFIG.indexDebounceMs, true);
        const dispose = effect(() => {
            var _a;
            const m = lastMutation.value;
            if (!m)
                return;
            if (m.type === "removed") {
                if (m.cardId)
                    this.removeSource("flashcard", m.cardId);
                if (m.cardIds) {
                    for (const id of m.cardIds)
                        this.removeSource("flashcard", id);
                }
                return;
            }
            if (m.type === "added" || m.type === "updated") {
                const ids = m.cardId ? [m.cardId] : ((_a = m.cardIds) !== null && _a !== void 0 ? _a : []);
                if (ids.length > 0)
                    debouncedCardIndex(ids);
            }
            if (m.type === "bulk" && m.cardIds) {
                debouncedCardIndex(m.cardIds);
            }
        });
        plugin.register(() => dispose());
    }
    indexSingleCard(cardId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const card = this.actions.getFlashcardDataById(cardId);
            if (!card)
                return false;
            const content = [card.fields_json, (_a = card.source_text) !== null && _a !== void 0 ? _a : ""].join(" ");
            const hash = yield this.contentHash(content);
            const meta = this.actions.getIndexMeta("flashcard", card.id);
            if (meta && meta.content_hash === hash)
                return false;
            const chunks = chunkFlashcard(card.fields_json, (_b = card.source_text) !== null && _b !== void 0 ? _b : undefined, (_c = card.tags) !== null && _c !== void 0 ? _c : undefined);
            this.actions.upsertChunks("flashcard", card.id, toUpsertChunks(chunks, hash));
            this.actions.upsertIndexMeta("flashcard", card.id, hash, Date.now(), chunks.length);
            return true;
        });
    }
    registerVaultEvents(plugin) {
        const debouncedIndex = debounce((file) => __awaiter(this, void 0, void 0, function* () {
            if (!this.settings().ragEnabled || !this.settings().ragAutoIndex)
                return;
            if (!this.shouldIndex(file))
                return;
            try {
                const wasIndexed = yield this.indexFile(file);
                if (wasIndexed)
                    yield this.embedPending();
            }
            catch (e) {
                console.error("[True Recall RAG] Auto-index error:", e);
            }
        }), RAG_CONFIG.indexDebounceMs, true);
        plugin.registerEvent(this.app.vault.on("modify", (file) => {
            if (file instanceof TFile && file.extension === "md") {
                debouncedIndex(file);
            }
        }));
        plugin.registerEvent(this.app.vault.on("delete", (file) => {
            if (file instanceof TFile) {
                this.removeSource("note", file.path);
            }
        }));
        plugin.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
            if (file instanceof TFile && file.extension === "md") {
                this.removeSource("note", oldPath);
                debouncedIndex(file);
            }
        }));
    }
    shouldIndex(file) {
        const s = this.settings();
        const path = file.path;
        if (s.ragExcludeFolders.some((f) => path.startsWith(f)))
            return false;
        if (s.ragIncludeFolders.length > 0) {
            return s.ragIncludeFolders.some((f) => path.startsWith(f));
        }
        return true;
    }
    indexFlashcards(onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            let indexed = 0;
            let skipped = 0;
            let errors = 0;
            const cards = this.actions.getFlashcardData();
            for (const [i, card] of cards.entries()) {
                try {
                    const wasIndexed = yield this.indexSingleCard(card.id);
                    if (wasIndexed)
                        indexed++;
                    else
                        skipped++;
                }
                catch (e) {
                    console.error("[True Recall RAG] Flashcard index error:", e);
                    errors++;
                }
                onProgress === null || onProgress === void 0 ? void 0 : onProgress({
                    phase: "flashcards",
                    current: i + 1,
                    total: cards.length,
                });
            }
            return { indexed, skipped, errors };
        });
    }
    embedPending(onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            let totalEmbedded = 0;
            const totalPending = this.actions.countChunksWithoutEmbedding();
            const MAX_BATCHES = 1000;
            let batchCount = 0;
            while (batchCount < MAX_BATCHES) {
                const pending = this.actions.getChunksWithoutEmbedding(RAG_CONFIG.embeddingBatchSize);
                if (pending.length === 0)
                    break;
                const texts = pending.map((c) => c.content);
                const embeddings = yield this.embedder.embed(texts);
                if (embeddings.length !== pending.length) {
                    console.error(`[True Recall RAG] Embedding count mismatch: expected ${pending.length}, got ${embeddings.length}. Skipping batch.`);
                    break;
                }
                const updates = [];
                for (let i = 0; i < pending.length; i++) {
                    const chunk = pending[i];
                    const emb = embeddings[i];
                    if (!chunk || !emb || emb.length === 0) {
                        console.warn(`[True Recall RAG] Empty embedding for chunk ${chunk === null || chunk === void 0 ? void 0 : chunk.id}, skipping`);
                        continue;
                    }
                    updates.push({ chunkId: chunk.id, embedding: emb });
                }
                this.actions.updateEmbeddingsBatch(updates);
                totalEmbedded += updates.length;
                batchCount++;
                onProgress === null || onProgress === void 0 ? void 0 : onProgress({
                    phase: "embedding",
                    current: totalEmbedded,
                    total: totalPending,
                });
            }
            if (totalEmbedded > 0) {
                (_a = this.searchService) === null || _a === void 0 ? void 0 : _a.invalidateCache();
            }
            const remaining = this.actions.countChunksWithoutEmbedding();
            return { embedded: totalEmbedded, truncated: remaining > 0, remaining };
        });
    }
    contentHash(content) {
        return __awaiter(this, void 0, void 0, function* () {
            const encoder = new TextEncoder();
            const data = encoder.encode(content);
            const hashBuffer = yield crypto.subtle.digest("SHA-256", data);
            const hashArray = new Uint8Array(hashBuffer);
            return Array.from(hashArray)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
        });
    }
}
