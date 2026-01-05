/**
 * OpenRouter API Service
 * Handles communication with OpenRouter AI API for flashcard generation
 */
import { requestUrl, RequestUrlParam } from "obsidian";
import {
    SYSTEM_PROMPT,
    UPDATE_SYSTEM_PROMPT,
    API_CONFIG,
    AIModelKey,
} from "../../constants";
import {
    validateOpenRouterResponse,
    extractContent,
    parseDiffJson,
    enrichFlashcardChanges,
    type FlashcardItem,
    type FlashcardChange,
    type ChatMessage,
} from "../../validation";
import {
    APIError,
    NetworkError,
    ConfigurationError,
} from "../../errors";

/**
 * Result of diff generation
 */
export interface DiffResult {
    changes: FlashcardChange[];
    existingFlashcards: FlashcardItem[];
}

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
     */
    async generateFlashcards(
        noteContent: string,
        userInstructions?: string
    ): Promise<string> {
        this.validateApiKey();

        const systemPrompt = this.buildSystemPrompt(SYSTEM_PROMPT, userInstructions);
        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: noteContent },
        ];

        const content = await this.callAPI(messages);
        return content.trim();
    }

    /**
     * Generate flashcard diff for update mode
     */
    async generateFlashcardsDiff(
        noteContent: string,
        existingFlashcards: FlashcardItem[],
        userInstructions?: string,
        oldNoteContent?: string
    ): Promise<DiffResult> {
        this.validateApiKey();

        // Build the existing flashcards list for the prompt
        const existingList = this.formatExistingFlashcards(existingFlashcards);
        const systemPrompt = this.buildSystemPrompt(
            UPDATE_SYSTEM_PROMPT + existingList,
            userInstructions
        );

        // Build user message with optional old note content for comparison
        const userMessage = this.buildDiffUserMessage(noteContent, oldNoteContent);

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ];

        const content = await this.callAPI(messages);
        return this.parseDiffResponse(content, existingFlashcards);
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
     * Format existing flashcards for the prompt
     */
    private formatExistingFlashcards(flashcards: FlashcardItem[]): string {
        return flashcards
            .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}`)
            .join("\n\n");
    }

    /**
     * Build user message for diff generation
     */
    private buildDiffUserMessage(noteContent: string, oldNoteContent?: string): string {
        if (oldNoteContent?.trim()) {
            return `PREVIOUS NOTE VERSION:\n${oldNoteContent}\n\n---\n\nCURRENT NOTE VERSION:\n${noteContent}\n\nPlease analyze what changed between the two versions and update flashcards accordingly.`;
        }
        return `NOTE CONTENT:\n${noteContent}`;
    }

    /**
     * Parse AI response and enrich with original data using Zod validators
     */
    private parseDiffResponse(
        content: string,
        existingFlashcards: FlashcardItem[]
    ): DiffResult {
        // Handle empty or NO_NEW_CARDS responses
        if (content.includes("NO_NEW_CARDS") || content.trim() === "") {
            return { changes: [], existingFlashcards };
        }

        // Use Zod validator to parse and validate changes
        const rawChanges = parseDiffJson(content);

        // Enrich changes with data from existing flashcards
        const changes = enrichFlashcardChanges(
            rawChanges.map(c => ({
                type: c.type,
                question: c.question,
                answer: c.answer,
                originalQuestion: c.originalQuestion,
                originalAnswer: c.originalAnswer,
                originalLineNumber: c.originalLineNumber,
                reason: c.reason,
            })),
            existingFlashcards
        );

        return { changes, existingFlashcards };
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
                "HTTP-Referer": "obsidian://episteme",
                "X-Title": "Episteme",
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
