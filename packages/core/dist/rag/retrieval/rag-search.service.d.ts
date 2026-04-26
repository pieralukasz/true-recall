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
    /** Resolved file path of the source note (enriched post-search) */
    sourceNotePath?: string;
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
export interface SearchOptions {
    topK?: number;
    sourceType?: RagSourceType | "all";
    sourceIds?: string[];
    /** Only return results modified after this timestamp (ms since epoch) */
    sinceMs?: number;
    /** Group results by source note/flashcard origin */
    groupBySource?: boolean;
}
export interface GroupedSearchResult {
    sourceId: string;
    sourceType: RagSourceType;
    displayName: string;
    /** Resolved note path (enriched post-search) */
    sourceNotePath?: string;
    headings: string[];
    bestScore: number;
    modifiedAt?: number;
    chunks: SearchResult[];
}
export interface SearchResponse {
    results: SearchResult[];
    grouped?: GroupedSearchResult[];
    stats: SearchStats;
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
    search(query: string, topKOrOpts?: number | SearchOptions, sourceType?: RagSourceType | "all", sourceIds?: string[]): Promise<SearchResponse>;
    private groupBySource;
    private makeGroupDisplayName;
    private cosineSearch;
    private ensureEmbeddingCache;
    invalidateCache(): void;
    private rrfMerge;
    private computeStats;
}
