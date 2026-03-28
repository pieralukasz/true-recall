import type { SqliteDatabase } from "@features/core/persistence/sqlite/SqliteDatabase";

export type RagSourceType = "note" | "flashcard";

export interface RagChunkRow {
	id: number;
	source_type: RagSourceType;
	source_id: string;
	chunk_index: number;
	content: string;
	heading_breadcrumb: string;
	token_count: number;
	content_hash: string;
	embedding: Uint8Array | null;
	created_at: number;
}

export interface RagIndexMetaRow {
	source_type: RagSourceType;
	source_id: string;
	content_hash: string;
	mtime: number;
	chunk_count: number;
	indexed_at: number;
}

export interface EmbeddingRow {
	id: number;
	embedding: Uint8Array;
}

export class RagChunkActions {
	constructor(private db: SqliteDatabase) {}

	getChunksBySource(
		sourceType: RagSourceType,
		sourceId: string,
	): RagChunkRow[] {
		return this.db.query<RagChunkRow>(
			`SELECT * FROM rag_chunks WHERE source_type = ? AND source_id = ? ORDER BY chunk_index`,
			[sourceType, sourceId],
		);
	}

	countChunksWithoutEmbedding(): number {
		return (
			this.db.get<{ count: number }>(
				`SELECT COUNT(*) as count FROM rag_chunks WHERE embedding IS NULL`,
			)?.count ?? 0
		);
	}

	getChunksWithoutEmbedding(limit: number): RagChunkRow[] {
		return this.db.query<RagChunkRow>(
			`SELECT * FROM rag_chunks WHERE embedding IS NULL ORDER BY id LIMIT ?`,
			[limit],
		);
	}

	getAllEmbeddings(): EmbeddingRow[] {
		return this.db.query<EmbeddingRow>(
			`SELECT id, embedding FROM rag_chunks WHERE embedding IS NOT NULL`,
		);
	}

	getChunksByIds(ids: number[]): RagChunkRow[] {
		if (ids.length === 0) return [];
		const placeholders = ids.map(() => "?").join(",");
		return this.db.query<RagChunkRow>(
			`SELECT * FROM rag_chunks WHERE id IN (${placeholders})`,
			ids,
		);
	}

	upsertChunks(
		sourceType: RagSourceType,
		sourceId: string,
		chunks: {
			content: string;
			headingBreadcrumb: string;
			tokenCount: number;
			contentHash: string;
		}[],
	): void {
		this.db.transaction(() => {
			this.db.run(
				`DELETE FROM rag_chunks WHERE source_type = ? AND source_id = ?`,
				[sourceType, sourceId],
			);

			const now = Date.now();
			for (const [i, c] of chunks.entries()) {
				this.db.run(
					`INSERT INTO rag_chunks (source_type, source_id, chunk_index, content, heading_breadcrumb, token_count, content_hash, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						sourceType,
						sourceId,
						i,
						c.content,
						c.headingBreadcrumb,
						c.tokenCount,
						c.contentHash,
						now,
					],
				);
			}
		});
	}

	updateEmbedding(chunkId: number, embedding: Float32Array): void {
		const buffer = new Uint8Array(embedding.buffer);
		this.db.run(`UPDATE rag_chunks SET embedding = ? WHERE id = ?`, [
			buffer,
			chunkId,
		]);
	}

	updateEmbeddingsBatch(
		updates: { chunkId: number; embedding: Float32Array }[],
	): void {
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

	deleteBySource(sourceType: RagSourceType, sourceId: string): void {
		this.db.run(
			`DELETE FROM rag_chunks WHERE source_type = ? AND source_id = ?`,
			[sourceType, sourceId],
		);
	}

	deleteAll(): void {
		this.db.transaction(() => {
			this.db.run(`DELETE FROM rag_chunks`);
			this.db.run(`DELETE FROM rag_index_meta`);
		});
	}

	// FTS5 keyword search — returns chunk IDs ordered by BM25 relevance (rank is negative; lower = more relevant)
	searchFts(query: string, limit: number): { id: number; rank: number }[] {
		const escaped = query
			.replace(/['"?*!+\-()^~:{}[\]\\@#$%&|<>=,;./]/g, " ")
			.trim();
		if (!escaped) return [];

		return this.db.query<{ id: number; rank: number }>(
			`SELECT rc.id, raf.rank
			 FROM rag_chunks_fts raf
			 JOIN rag_chunks rc ON rc.rowid = raf.rowid
			 WHERE rag_chunks_fts MATCH ?
			 ORDER BY raf.rank
			 LIMIT ?`,
			[escaped, limit],
		);
	}

	getIndexMeta(
		sourceType: RagSourceType,
		sourceId: string,
	): RagIndexMetaRow | null {
		return (
			this.db.get<RagIndexMetaRow>(
				`SELECT * FROM rag_index_meta WHERE source_type = ? AND source_id = ?`,
				[sourceType, sourceId],
			) ?? null
		);
	}

	upsertIndexMeta(
		sourceType: RagSourceType,
		sourceId: string,
		contentHash: string,
		mtime: number,
		chunkCount: number,
	): void {
		this.db.run(
			`INSERT OR REPLACE INTO rag_index_meta (source_type, source_id, content_hash, mtime, chunk_count, indexed_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[sourceType, sourceId, contentHash, mtime, chunkCount, Date.now()],
		);
	}

	deleteIndexMeta(sourceType: RagSourceType, sourceId: string): void {
		this.db.run(
			`DELETE FROM rag_index_meta WHERE source_type = ? AND source_id = ?`,
			[sourceType, sourceId],
		);
	}

	getFsrsDataForChunks(chunkIds: number[]): {
		card_id: string;
		source_uid: string | null;
		state: number;
		stability: number;
		difficulty: number;
		lapses: number;
		reps: number;
		last_review: string | null;
		due: string;
	}[] {
		if (chunkIds.length === 0) return [];
		const placeholders = chunkIds.map(() => "?").join(",");
		return this.db.query(
			`SELECT c.id as card_id, c.source_uid, c.state, c.stability, c.difficulty,
				c.lapses, c.reps, c.last_review, c.due
			 FROM rag_chunks rc
			 JOIN cards c ON rc.source_id = c.id
			 WHERE rc.id IN (${placeholders}) AND rc.source_type = 'flashcard'`,
			chunkIds,
		);
	}

	getFlashcardDataById(cardId: string): {
		id: string;
		fields_json: string;
		source_text: string | null;
		tags: string | null;
	} | null {
		return (
			this.db.get<{
				id: string;
				fields_json: string;
				source_text: string | null;
				tags: string | null;
			}>(
				`SELECT c.id, n.fields_json, n.source_text, n.tags
			 FROM cards c
			 JOIN notes n ON c.note_id = n.id
			 WHERE c.id = ? AND c.deleted_at IS NULL`,
				[cardId],
			) ?? null
		);
	}

	getFlashcardData(): {
		id: string;
		fields_json: string;
		source_text: string | null;
		tags: string | null;
	}[] {
		return this.db.query(
			`SELECT c.id, n.fields_json, n.source_text, n.tags
			 FROM cards c
			 JOIN notes n ON c.note_id = n.id
			 WHERE c.deleted_at IS NULL`,
		);
	}

	getIndexedSources(): RagIndexMetaRow[] {
		return this.db.query<RagIndexMetaRow>(
			`SELECT * FROM rag_index_meta ORDER BY indexed_at DESC`,
		);
	}

	getStats(): {
		totalChunks: number;
		embeddedChunks: number;
		noteCount: number;
		flashcardCount: number;
		lastIndexedAt: number | null;
	} {
		const total =
			this.db.get<{ count: number }>(`SELECT COUNT(*) as count FROM rag_chunks`)
				?.count ?? 0;

		const embedded =
			this.db.get<{ count: number }>(
				`SELECT COUNT(*) as count FROM rag_chunks WHERE embedding IS NOT NULL`,
			)?.count ?? 0;

		const notes =
			this.db.get<{ count: number }>(
				`SELECT COUNT(DISTINCT source_id) as count FROM rag_index_meta WHERE source_type = 'note'`,
			)?.count ?? 0;

		const flashcards =
			this.db.get<{ count: number }>(
				`SELECT COUNT(DISTINCT source_id) as count FROM rag_index_meta WHERE source_type = 'flashcard'`,
			)?.count ?? 0;

		const lastRow = this.db.get<{ last: number | null }>(
			`SELECT MAX(indexed_at) as last FROM rag_index_meta`,
		);

		return {
			totalChunks: total,
			embeddedChunks: embedded,
			noteCount: notes,
			flashcardCount: flashcards,
			lastIndexedAt: lastRow?.last ?? null,
		};
	}
}
