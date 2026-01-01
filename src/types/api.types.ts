/**
 * API-related types for OpenRouter integration
 */

// Chat message format for OpenRouter API
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

// OpenRouter API response structure
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

// OpenRouter API error structure
export interface OpenRouterError {
    message: string;
    code?: string;
}

// Configuration for OpenRouter service
export interface OpenRouterConfig {
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
}

// API request configuration
export interface APIRequestConfig {
    endpoint: string;
    timeout: number;
    defaultTemperature: number;
    defaultMaxTokens: number;
    retryAttempts: number;
    retryDelay: number;
}
