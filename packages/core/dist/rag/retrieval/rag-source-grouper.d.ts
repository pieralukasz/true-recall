import type { RagSourceType } from "@true-recall/core/rag/indexing/rag-chunk-actions";
import type { SearchResult } from "@true-recall/core/rag/retrieval/rag-search.service";
export interface GroupedSource {
    sourceId: string;
    sourceType: RagSourceType;
    displayName: string;
    headings: string[];
    chunks: SearchResult[];
    bestScore: number;
}
export declare function groupSources(sources: SearchResult[]): GroupedSource[];
export declare function stripMarkdown(text: string): string;
