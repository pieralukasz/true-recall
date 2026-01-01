/**
 * Zod schemas for OpenRouter API responses
 */
import { z } from "zod";

// ===== OpenRouter API Response Schemas =====

/**
 * Schema for API error response
 */
export const OpenRouterErrorSchema = z.object({
    message: z.string(),
    code: z.string().optional(),
});

/**
 * Schema for a single choice in the response
 */
export const OpenRouterChoiceSchema = z.object({
    message: z.object({
        content: z.string(),
        role: z.enum(["assistant"]).optional(),
    }),
    finish_reason: z.string().optional(),
    index: z.number().optional(),
});

/**
 * Schema for the complete OpenRouter API response
 */
export const OpenRouterResponseSchema = z.object({
    id: z.string().optional(),
    model: z.string().optional(),
    choices: z.array(OpenRouterChoiceSchema).min(1, "Response must have at least one choice"),
    error: OpenRouterErrorSchema.optional(),
    usage: z.object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
        total_tokens: z.number(),
    }).optional(),
});

// ===== Chat Message Schema =====

/**
 * Schema for chat messages sent to API
 */
export const ChatMessageSchema = z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1, "Message content cannot be empty"),
});

// ===== Inferred Types from Schemas =====

export type OpenRouterError = z.infer<typeof OpenRouterErrorSchema>;
export type OpenRouterChoice = z.infer<typeof OpenRouterChoiceSchema>;
export type OpenRouterResponse = z.infer<typeof OpenRouterResponseSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
