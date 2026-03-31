import type { IHttpClient } from "../../interfaces/http-client";
import { type ChatMessage } from "./openrouter-client";
export interface StreamingChatRequest {
    messages: ChatMessage[];
    temperature?: number;
    metadata?: Record<string, unknown>;
}
export interface StreamChunk {
    content: string;
    finishReason: string | null;
}
export declare class StreamingOpenRouterClient {
    private apiKey;
    private model;
    private httpClient;
    private baseUrl;
    private userId?;
    constructor(apiKey: string, model: string, httpClient: IHttpClient, baseUrl?: string, userId?: string | undefined);
    chatStream(request: StreamingChatRequest, signal?: AbortSignal): AsyncGenerator<StreamChunk>;
}
