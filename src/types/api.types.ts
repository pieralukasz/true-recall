export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface OpenRouterResponse {
    id?: string;
    choices?: Array<{
        message: {
            content: string;
            role?: string;
        };
        finish_reason?: string;
    }>;
    error?: OpenRouterError;
}

export interface OpenRouterError {
    message: string;
    code?: string;
}

export interface OpenRouterConfig {
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
}

export interface APIRequestConfig {
    endpoint: string;
    timeout: number;
    defaultTemperature: number;
    defaultMaxTokens: number;
    retryAttempts: number;
    retryDelay: number;
}
