export class RagChunkActions {
    constructor(db) {
        this.db = db;
    }
    getChunksBySource(sourceType, sourceId) {
        return this.db.query(`SELECT * FROM rag_chunks WHERE source_type = ? AND source_id = ? ORDER BY chunk_index`, [sourceType, sourceId]);
    }
    countChunksWithoutEmbedding() {
        var _a, _b;
        return ((_b = (_a = this.db.get(`SELECT COUNT(*) as count FROM rag_chunks WHERE embedding IS NULL`)) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0);
    }
    getChunksWithoutEmbedding(limit) {
        return this.db.query(`SELECT * FROM rag_chunks WHERE embedding IS NULL ORDER BY id LIMIT ?`, [limit]);
    }
    getAllEmbeddings() {
        return this.db.query(`SELECT id, embedding FROM rag_chunks WHERE embedding IS NOT NULL`);
    }
    getChunksByIds(ids) {
        if (ids.length === 0)
            return [];
        const placeholders = ids.map(() => "?").join(",");
        return this.db.query(`SELECT * FROM rag_chunks WHERE id IN (${placeholders})`, ids);
    }
    upsertChunks(sourceType, sourceId, chunks) {
        this.db.transaction(() => {
            this.db.run(`DELETE FROM rag_chunks WHERE source_type = ? AND source_id = ?`, [sourceType, sourceId]);
            const now = Date.now();
            for (const [i, c] of chunks.entries()) {
                this.db.run(`INSERT INTO rag_chunks (source_type, source_id, chunk_index, content, heading_breadcrumb, token_count, content_hash, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    sourceType,
                    sourceId,
                    i,
                    c.content,
                    c.headingBreadcrumb,
                    c.tokenCount,
                    c.contentHash,
                    now,
                ]);
            }
        });
    }
    updateEmbedding(chunkId, embedding) {
        const buffer = new Uint8Array(embedding.buffer);
        this.db.run(`UPDATE rag_chunks SET embedding = ? WHERE id = ?`, [
            buffer,
            chunkId,
        ]);
    }
    updateEmbeddingsBatch(updates) {
        this.db.transaction(() => {
            for (const u of updates) {
                const buffer = new Uint8Array(u.embedding.buffer);
                this.db.run(`UPDATE rag_chunks SET embedding = ? WHERE id = ?`, [
                    buffer,
                    u.chunkId,
                ]);
            }
        });
    }
    deleteBySource(sourceType, sourceId) {
        this.db.run(`DELETE FROM rag_chunks WHERE source_type = ? AND source_id = ?`, [sourceType, sourceId]);
    }
    deleteAll() {
        this.db.transaction(() => {
            this.db.run(`DELETE FROM rag_chunks`);
            this.db.run(`DELETE FROM rag_index_meta`);
        });
    }
    // FTS5 keyword search — returns chunk IDs ordered by BM25 relevance (rank is negative; lower = more relevant)
    searchFts(query, limit) {
        const escaped = query
            .replace(/['"?*!+\-()^~:{}[\]\\@#$%&|<>=,;./]/g, " ")
            .trim();
        if (!escaped)
            return [];
        return this.db.query(`SELECT rc.id, raf.rank
			 FROM rag_chunks_fts raf
			 JOIN rag_chunks rc ON rc.rowid = raf.rowid
			 WHERE rag_chunks_fts MATCH ?
			 ORDER BY raf.rank
			 LIMIT ?`, [escaped, limit]);
    }
    getIndexMeta(sourceType, sourceId) {
        var _a;
        return ((_a = this.db.get(`SELECT * FROM rag_index_meta WHERE source_type = ? AND source_id = ?`, [sourceType, sourceId])) !== null && _a !== void 0 ? _a : null);
    }
    upsertIndexMeta(sourceType, sourceId, contentHash, mtime, chunkCount) {
        this.db.run(`INSERT OR REPLACE INTO rag_index_meta (source_type, source_id, content_hash, mtime, chunk_count, indexed_at)
			 VALUES (?, ?, ?, ?, ?, ?)`, [sourceType, sourceId, contentHash, mtime, chunkCount, Date.now()]);
    }
    deleteIndexMeta(sourceType, sourceId) {
        this.db.run(`DELETE FROM rag_index_meta WHERE source_type = ? AND source_id = ?`, [sourceType, sourceId]);
    }
    getFsrsDataForChunks(chunkIds) {
        if (chunkIds.length === 0)
            return [];
        const placeholders = chunkIds.map(() => "?").join(",");
        return this.db.query(`SELECT c.id as card_id, c.source_uid, c.state, c.stability, c.difficulty,
				c.lapses, c.reps, c.last_review, c.due
			 FROM rag_chunks rc
			 JOIN cards c ON rc.source_id = c.id
			 WHERE rc.id IN (${placeholders}) AND rc.source_type = 'flashcard'`, chunkIds);
    }
    getFlashcardDataById(cardId) {
        var _a;
        return ((_a = this.db.get(`SELECT c.id, n.fields_json, n.source_text, n.tags
			 FROM cards c
			 JOIN notes n ON c.note_id = n.id
			 WHERE c.id = ? AND c.deleted_at IS NULL`, [cardId])) !== null && _a !== void 0 ? _a : null);
    }
    getFlashcardData() {
        return this.db.query(`SELECT c.id, n.fields_json, n.source_text, n.tags
			 FROM cards c
			 JOIN notes n ON c.note_id = n.id
			 WHERE c.deleted_at IS NULL`);
    }
    getMtimeForChunks(chunkIds) {
        if (chunkIds.length === 0)
            return new Map();
        const placeholders = chunkIds.map(() => "?").join(",");
        const rows = this.db.query(`SELECT rc.id, rim.mtime
			 FROM rag_chunks rc
			 JOIN rag_index_meta rim ON rc.source_type = rim.source_type AND rc.source_id = rim.source_id
			 WHERE rc.id IN (${placeholders})`, chunkIds);
        return new Map(rows.map((r) => [r.id, r.mtime]));
    }
    getIndexedSources() {
        return this.db.query(`SELECT * FROM rag_index_meta ORDER BY indexed_at DESC`);
    }
    getStats() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const total = (_b = (_a = this.db.get(`SELECT COUNT(*) as count FROM rag_chunks`)) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0;
        const embedded = (_d = (_c = this.db.get(`SELECT COUNT(*) as count FROM rag_chunks WHERE embedding IS NOT NULL`)) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0;
        const notes = (_f = (_e = this.db.get(`SELECT COUNT(DISTINCT source_id) as count FROM rag_index_meta WHERE source_type = 'note'`)) === null || _e === void 0 ? void 0 : _e.count) !== null && _f !== void 0 ? _f : 0;
        const flashcards = (_h = (_g = this.db.get(`SELECT COUNT(DISTINCT source_id) as count FROM rag_index_meta WHERE source_type = 'flashcard'`)) === null || _g === void 0 ? void 0 : _g.count) !== null && _h !== void 0 ? _h : 0;
        const lastRow = this.db.get(`SELECT MAX(indexed_at) as last FROM rag_index_meta`);
        return {
            totalChunks: total,
            embeddedChunks: embedded,
            noteCount: notes,
            flashcardCount: flashcards,
            lastIndexedAt: (_j = lastRow === null || lastRow === void 0 ? void 0 : lastRow.last) !== null && _j !== void 0 ? _j : null,
        };
    }
}
