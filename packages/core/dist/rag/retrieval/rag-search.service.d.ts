import type { RagChunkActions, RagSourceType } from "../indexing/rag-chunk-actions";
export interface RagEmbeddingService {
    embedSingle(text: string): Promise<Float32Array>;
    embed(texts: string[]): Promise<Float32Array[]>;
}
export interface SearchResult {
    chunkId: number;
    content: string;
    headingBreadcrumb: string;
    sourceType: RagSourceType;
    sourceId: string;
    /** For flashcards: the source_uid linking to the originating note */
    sourceNoteUid?: string;
    score: number;
    tokenCount: number;
    /** Source file modification time (ms since epoch) from rag_index_meta */
    modifiedAt?: number;
    fsrs?: {
        state: number;
        stability: number;
        difficulty: number;
        lapses: number;
        reps: number;
        lastReview?: string;
        due: string;
    };
}
export interface SearchStats {
    totalChunksSearched: number;
    notesMatched: number;
    flashcardsMatched: number;
    flashcardsByState: {
        new: number;
        learning: number;
        review: number;
        relearning: number;
    };
}
export declare class RagSearchService {
    private actions;
    private embedder;
    private embeddingCache;
    constructor(actions: RagChunkActions, embedder: RagEmbeddingService);
    search(query: string, topK?: number, sourceType?: RagSourceType | "all", sourceIds?: string[]): Promise<{
        results: SearchResult[];
        stats: SearchStats;
    }>;
    private cosineSearch;
    private ensureEmbeddingCache;
    invalidateCache(): void;
    private rrfMerge;
    private computeStats;
}
