import { requestUrl, RequestUrlParam } from "obsidian";
import { SYSTEM_PROMPT, UPDATE_SYSTEM_PROMPT, OPENROUTER_API_URL, AIModelKey } from "./constants";
import { FlashcardChange, FlashcardItem, DiffResult } from "./flashcardManager";

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

    // Generate flashcards from note content (for initial generation)
    async generateFlashcards(noteContent: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error("OpenRouter API key not configured. Please add your API key in settings.");
        }

        const messages: ChatMessage[] = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: noteContent }
        ];

        const content = await this.callOpenRouter(messages);
        return content.trim();
    }

    // Generate flashcard diff for update mode
    async generateFlashcardsDiff(
        noteContent: string,
        existingFlashcards: FlashcardItem[]
    ): Promise<DiffResult> {
        if (!this.apiKey) {
            throw new Error("OpenRouter API key not configured. Please add your API key in settings.");
        }

        // Build the existing flashcards list for the prompt
        const existingList = existingFlashcards
            .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}`)
            .join("\n\n");

        const systemPrompt = UPDATE_SYSTEM_PROMPT + existingList;

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `NOTE CONTENT:\n${noteContent}` }
        ];

        const content = await this.callOpenRouter(messages);

        // Parse JSON response
        return this.parseDiffResponse(content, existingFlashcards);
    }

    // Parse AI response and enrich with original data
    private parseDiffResponse(content: string, existingFlashcards: FlashcardItem[]): DiffResult {
        // Try to extract JSON from response (AI might include extra text)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            // No JSON found - might be empty or error
            if (content.includes("NO_NEW_CARDS") || content.trim() === "") {
                return { changes: [], existingFlashcards };
            }
            throw new Error("Invalid response format: no JSON found");
        }

        try {
            const parsed = JSON.parse(jsonMatch[0]) as { changes?: unknown[] };

            if (!parsed.changes || !Array.isArray(parsed.changes)) {
                return { changes: [], existingFlashcards };
            }

            const changes: FlashcardChange[] = parsed.changes.map((change: unknown) => {
                const c = change as Record<string, unknown>;
                const type = c.type as "NEW" | "MODIFIED" | "DELETED";

                // For DELETED, we get question/answer from existing flashcards
                if (type === "DELETED" && c.originalQuestion) {
                    const originalQuestion = String(c.originalQuestion);
                    const existing = existingFlashcards.find(
                        f => f.question === originalQuestion
                    );

                    return {
                        type,
                        question: existing?.question || originalQuestion,
                        answer: existing?.answer || "",
                        originalQuestion,
                        originalAnswer: existing?.answer,
                        originalLineNumber: existing?.lineNumber,
                        reason: c.reason ? String(c.reason) : undefined,
                        accepted: false // DELETED defaults to rejected (user must explicitly accept)
                    };
                }

                // For NEW and MODIFIED
                const question = String(c.question || "");
                const answer = String(c.answer || "");

                const result: FlashcardChange = {
                    type,
                    question,
                    answer,
                    accepted: true // NEW and MODIFIED default to accepted
                };

                // For MODIFIED, find the original flashcard
                if (type === "MODIFIED" && c.originalQuestion) {
                    const originalQuestion = String(c.originalQuestion);
                    result.originalQuestion = originalQuestion;

                    // Find matching existing flashcard
                    const existing = existingFlashcards.find(
                        f => f.question === originalQuestion
                    );
                    if (existing) {
                        result.originalAnswer = existing.answer;
                        result.originalLineNumber = existing.lineNumber;
                    }
                }

                return result;
            });

            return { changes, existingFlashcards };
        } catch {
            throw new Error("Failed to parse AI response as JSON");
        }
    }

    // Common OpenRouter API call
    private async callOpenRouter(messages: ChatMessage[]): Promise<string> {
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

            return content;
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("net::")) {
                    throw new Error("Network error: Unable to connect to OpenRouter. Please check your internet connection.");
                }
                throw error;
            }
            throw new Error(`Failed to call OpenRouter: ${String(error)}`);
        }
    }
}
