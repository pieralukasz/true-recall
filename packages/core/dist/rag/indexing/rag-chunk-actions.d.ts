import type { SqliteDatabase } from "@true-recall/core/persistence/sqlite/SqliteDatabase";
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
export declare class RagChunkActions {
    private db;
    constructor(db: SqliteDatabase);
    getChunksBySource(sourceType: RagSourceType, sourceId: string): RagChunkRow[];
    countChunksWithoutEmbedding(): number;
    getChunksWithoutEmbedding(limit: number): RagChunkRow[];
    getAllEmbeddings(): EmbeddingRow[];
    getChunksByIds(ids: number[]): RagChunkRow[];
    upsertChunks(sourceType: RagSourceType, sourceId: string, chunks: {
        content: string;
        headingBreadcrumb: string;
        tokenCount: number;
        contentHash: string;
    }[]): void;
    updateEmbedding(chunkId: number, embedding: Float32Array): void;
    updateEmbeddingsBatch(updates: {
        chunkId: number;
        embedding: Float32Array;
    }[]): void;
    deleteBySource(sourceType: RagSourceType, sourceId: string): void;
    deleteAll(): void;
    searchFts(query: string, limit: number): {
        id: number;
        rank: number;
    }[];
    getIndexMeta(sourceType: RagSourceType, sourceId: string): RagIndexMetaRow | null;
    upsertIndexMeta(sourceType: RagSourceType, sourceId: string, contentHash: string, mtime: number, chunkCount: number): void;
    deleteIndexMeta(sourceType: RagSourceType, sourceId: string): void;
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
    }[];
    getFlashcardDataById(cardId: string): {
        id: string;
        fields_json: string;
        source_text: string | null;
        tags: string | null;
    } | null;
    getFlashcardData(): {
        id: string;
        fields_json: string;
        source_text: string | null;
        tags: string | null;
    }[];
    getMtimeForChunks(chunkIds: number[]): Map<number, number>;
    getIndexedSources(): RagIndexMetaRow[];
    getStats(): {
        totalChunks: number;
        embeddedChunks: number;
        noteCount: number;
        flashcardCount: number;
        lastIndexedAt: number | null;
    };
}
