import { requestUrl, RequestUrlParam } from "obsidian";
import { SYSTEM_PROMPT, UPDATE_PROMPT_PREFIX, OPENROUTER_API_URL, AIModelKey } from "./constants";

// OpenRouter API response types
interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface OpenRouterResponse {
    choices?: Array<{
        message: {
            content: string;
        };
    }>;
    error?: {
        message: string;
        code?: string;
    };
}

export class OpenRouterService {
    private apiKey: string;
    private model: AIModelKey;

    constructor(apiKey: string, model: AIModelKey) {
        this.apiKey = apiKey;
        this.model = model;
    }

    // Update credentials (called when settings change)
    updateCredentials(apiKey: string, model: AIModelKey): void {
        this.apiKey = apiKey;
        this.model = model;
    }

    // Generate flashcards from note content
    async generateFlashcards(
        noteContent: string,
        existingQuestions?: string[]
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error("OpenRouter API key not configured. Please add your API key in settings.");
        }

        const messages: ChatMessage[] = [
            { role: "system", content: SYSTEM_PROMPT }
        ];

        // Build user message
        let userContent = noteContent;

        // If updating, add blocklist of existing questions
        if (existingQuestions && existingQuestions.length > 0) {
            const blocklist = existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n");
            userContent = UPDATE_PROMPT_PREFIX + blocklist + "\n\n---\n\nNOTE CONTENT:\n" + noteContent;
        }

        messages.push({ role: "user", content: userContent });

        const requestBody = {
            model: this.model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 4000
        };

        const options: RequestUrlParam = {
            url: OPENROUTER_API_URL,
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "obsidian://shadow-anki",
                "X-Title": "Shadow Anki"
            },
            body: JSON.stringify(requestBody)
        };

        try {
            const response = await requestUrl(options);
            const data = response.json as OpenRouterResponse;

            if (data.error) {
                throw new Error(`OpenRouter API Error: ${data.error.message}`);
            }

            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error("No content in OpenRouter response");
            }

            return content.trim();
        } catch (error) {
            if (error instanceof Error) {
                // Re-throw with more context if it's a network error
                if (error.message.includes("net::")) {
                    throw new Error("Network error: Unable to connect to OpenRouter. Please check your internet connection.");
                }
                throw error;
            }
            throw new Error(`Failed to generate flashcards: ${String(error)}`);
        }
    }
}
