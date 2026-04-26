import type { IHttpClient } from "../../interfaces/http-client";
export interface TextContentPart {
    type: "text";
    text: string;
}
export interface ImageUrlContentPart {
    type: "image_url";
    image_url: {
        url: string;
    };
}
export type ContentPart = TextContentPart | ImageUrlContentPart;
export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | ContentPart[] | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}
export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}
export interface ToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}
interface ChatCompletionRequest {
    messages: ChatMessage[];
    temperature?: number;
    tools?: ToolDefinition[];
    tool_choice?: "auto" | "none";
    metadata?: Record<string, unknown>;
}
export interface ChatCompletionResponse {
    id: string;
    choices: Array<{
        message: ChatMessage;
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
}
export declare const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export declare function buildOpenRouterHeaders(apiKey: string, userId?: string, capability?: string): Record<string, string>;
/** Extract text content from a ChatMessage response (handles both string and ContentPart[] content). */
export declare function getTextContent(message: ChatMessage | undefined): string;
export declare class AIRequestError extends Error {
    readonly statusCode: number;
    constructor(statusCode: number, responseText: string);
    get isRateLimited(): boolean;
    get isUnauthorized(): boolean;
}
export interface AIClientOptions {
    apiKey: string;
    model: string;
}
export declare class OpenRouterClient {
    private apiKey;
    private model;
    private httpClient;
    private baseUrl;
    private userId?;
    private capability?;
    constructor(apiKey: string, model: string, httpClient: IHttpClient, baseUrl?: string, userId?: string | undefined, capability?: string | undefined);
    chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}
export {};
