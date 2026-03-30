import type { ContextItem } from "../context/context.types";
import type { ChatTurn, RagQueryService } from "./rag-query.service";
export declare class RagChatService {
    private queryService;
    private history;
    constructor(queryService: RagQueryService);
    sendMessage(message: string, context?: ContextItem[]): AsyncGenerator<string>;
    clearHistory(): void;
    getHistory(): ChatTurn[];
}
