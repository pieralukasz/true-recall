import type { ToolCall, ToolDefinition } from "@true-recall/core/ai/clients/openrouter-client";
import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { FSRSHelperService } from "@true-recall/core/metrics/fsrs-tools/fsrs-helper.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type { DayBoundaryService } from "@true-recall/core/services/review/day-boundary.service";
import type { RagSearchService, SearchResult } from "../retrieval/rag-search.service";
export declare const RAG_CHAT_TOOLS: ToolDefinition[];
export interface ToolResult {
    content: string;
    searchResults?: SearchResult[];
}
export declare class RagToolExecutor {
    private ragSearch;
    private cardStore;
    private fsrsHelper;
    private flashcardManager;
    private dayBoundary;
    private hierarchy;
    constructor(ragSearch: RagSearchService, cardStore: SqliteStoreService, fsrsHelper: FSRSHelperService, flashcardManager: FlashcardManager, dayBoundary: DayBoundaryService, hierarchy: HierarchyService);
    execute(call: ToolCall): Promise<ToolResult>;
    private searchKnowledge;
    private getStudyProgress;
    private getRetentionAnalytics;
    private getProblemCards;
    private getStudyPatterns;
    private getSessionAnalysis;
    private getDailyStats;
}
