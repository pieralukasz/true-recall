import type { FrontmatterIndexService } from "@true-recall/core/services/notes/frontmatter-index.service";
import type { TrueRecallSettings } from "@true-recall/core/types/settings.types";
import type { IHttpClient } from "@true-recall/core/interfaces/http-client";
import type { ContextItem } from "../context/context.types";
import { type RagToolExecutor } from "@true-recall/core/rag/chat/rag-chat-tools";
import type { RagSearchService, SearchResult } from "@true-recall/core/rag/retrieval/rag-search.service";
export interface ToolCallRecord {
    id: string;
    name: string;
    arguments: string;
    result: string;
}
export interface ChatTurn {
    role: "user" | "assistant";
    content: string;
    sources?: SearchResult[];
    toolCalls?: ToolCallRecord[];
    timestamp: number;
}
export type ContextResolver = (items: ContextItem[]) => Promise<string>;
export declare class RagQueryService {
    private search;
    private settings;
    private httpClient;
    private frontmatterIndex?;
    private toolExecutor?;
    private contextResolver?;
    private lastSearchResults;
    private lastToolCalls;
    constructor(search: RagSearchService, settings: () => TrueRecallSettings, httpClient: IHttpClient, frontmatterIndex?: FrontmatterIndexService | undefined, toolExecutor?: RagToolExecutor | undefined, contextResolver?: ContextResolver | undefined);
    queryStream(question: string, history: ChatTurn[], attachedItems?: ContextItem[]): AsyncGenerator<string>;
    getLastSearchResults(): SearchResult[];
    getLastToolCalls(): ToolCallRecord[];
    private agenticFlow;
    private fallbackFlow;
    packContext(results: SearchResult[]): {
        context: string;
        sourceMap: SearchResult[];
    };
    private buildMessages;
}
