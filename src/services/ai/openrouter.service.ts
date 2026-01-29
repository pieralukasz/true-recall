/**
 * OpenRouter API Service
 * Handles communication with OpenRouter AI API for flashcard generation
 */
import { requestUrl, RequestUrlParam } from "obsidian";
import {
    SYSTEM_PROMPT,
    API_CONFIG,
    AIModelKey,
} from "../../constants";
import {
    validateOpenRouterResponse,
    extractContent,
} from "../../validation";
import { type FlashcardItem, type ChatMessage } from "../../types";
import {
    APIError,
    NetworkError,
    ConfigurationError,
} from "../../errors";

/**
 * Service for interacting with OpenRouter API
 */
export class OpenRouterService {
    private apiKey: string;
    private model: AIModelKey;

    constructor(apiKey: string, model: AIModelKey) {
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * Update credentials (called when settings change)
     */
    updateCredentials(apiKey: string, model: AIModelKey): void {
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * Generate flashcards from note content (for initial generation)
     * @param noteContent - The note content to generate flashcards from
     * @param userInstructions - Optional user instructions to append to the prompt
     * @param customSystemPrompt - Optional custom system prompt (empty = use default SYSTEM_PROMPT)
     */
    async generateFlashcards(
        noteContent: string,
        userInstructions?: string,
        customSystemPrompt?: string
    ): Promise<string> {
        this.validateApiKey();

        const basePrompt = customSystemPrompt?.trim() || SYSTEM_PROMPT;
        const systemPrompt = this.buildSystemPrompt(basePrompt, userInstructions);
        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: noteContent },
        ];

        const content = await this.callAPI(messages);
        return content.trim();
    }

    /**
     * Refine existing flashcards based on user instructions
     * Used in the review modal to improve AI-generated flashcards
     */
    async refineFlashcards(
        flashcards: FlashcardItem[],
        userInstructions: string
    ): Promise<FlashcardItem[]> {
        this.validateApiKey();

        // Build flashcard list for context
        const flashcardList = flashcards
            .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}`)
            .join("\n\n");

        const systemPrompt = `You are an expert flashcard refiner. Your task is to improve and expand flashcards based on user instructions.

CURRENT FLASHCARDS:
${flashcardList}

INSTRUCTIONS: ${userInstructions}

IMPROVEMENT RULES:
- Keep questions concise and specific
- Ensure answers are accurate and complete
- Maintain the markdown format: [Question] #flashcard\\n[Answer]

YOU MAY:
- Add new flashcards if instructed (e.g., "add 3 more cards about X")
- Split flashcards into multiple cards (e.g., "split card 2 into two separate cards")
- Remove duplicate or unnecessary flashcards
- Merge related concepts if appropriate

Return ALL flashcards (modified, new, and remaining originals) in the format.
Format each as: [Question text] #flashcard\\n[Answer text]`;

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
        ];

        const content = await this.callAPI(messages);

        // Parse refined flashcards using FlashcardParserService
        const { FlashcardParserService } = await import("../flashcard/flashcard-parser.service");
        const parser = new FlashcardParserService();
        const refined = parser.extractFlashcards(content);

        // Accept the AI's response if it returned any flashcards
        // This allows the count to change (add/remove/split)
        if (refined.length > 0) {
            return refined;
        }

        // Fallback to original only if AI failed completely
        return flashcards;
    }

    /**
     * Validate that API key is configured
     */
    private validateApiKey(): void {
        if (!this.apiKey?.trim()) {
            throw new ConfigurationError(
                "OpenRouter API key not configured. Please add your API key in settings.",
                "openRouterApiKey"
            );
        }
    }

    /**
     * Build system prompt with optional user instructions
     */
    private buildSystemPrompt(basePrompt: string, userInstructions?: string): string {
        if (userInstructions?.trim()) {
            return `${basePrompt}\n\nADDITIONAL USER INSTRUCTIONS:\n${userInstructions.trim()}`;
        }
        return basePrompt;
    }

    /**
     * Make API call to OpenRouter
     */
    private async callAPI(messages: ChatMessage[]): Promise<string> {
        const requestBody = {
            model: this.model,
            messages: messages,
            temperature: API_CONFIG.defaultTemperature,
            max_tokens: API_CONFIG.defaultMaxTokens,
        };

        const options: RequestUrlParam = {
            url: API_CONFIG.endpoint,
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "obsidian://true-recall",
                "X-Title": "True Recall",
            },
            body: JSON.stringify(requestBody),
        };

        try {
            const response = await requestUrl(options);

            // Validate response using Zod schema
            const validatedResponse = validateOpenRouterResponse(response.json);

            // Extract content from validated response
            return extractContent(validatedResponse);
        } catch (error) {
            // Re-throw our custom errors as-is
            if (error instanceof APIError || error instanceof ConfigurationError) {
                throw error;
            }

            // Handle network errors
            if (error instanceof Error) {
                if (error.message.includes("net::") || error.message.includes("fetch")) {
                    throw new NetworkError(
                        "Unable to connect to OpenRouter. Please check your internet connection."
                    );
                }
                // Wrap other errors in APIError
                throw new APIError(error.message, undefined, "OpenRouter");
            }

            throw new APIError(`Failed to call OpenRouter: ${String(error)}`, undefined, "OpenRouter");
        }
    }
}
