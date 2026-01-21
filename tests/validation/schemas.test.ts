import { describe, it, expect } from "vitest";
import {
    OpenRouterResponseSchema,
    FlashcardItemSchema,
    FlashcardChangeTypeSchema,
    SettingsSchema,
    DiffResponseSchema,
} from "../../src/validation/schemas";

describe("Zod Schemas", () => {
    describe("OpenRouterResponseSchema", () => {
        it("should parse valid response", () => {
            const data = {
                choices: [
                    {
                        message: {
                            content: "Hello world",
                        },
                    },
                ],
            };

            const result = OpenRouterResponseSchema.safeParse(data);

            expect(result.success).toBe(true);
        });

        it("should reject response without choices", () => {
            const data = {};

            const result = OpenRouterResponseSchema.safeParse(data);

            expect(result.success).toBe(false);
        });

        it("should reject response with empty choices", () => {
            const data = { choices: [] };

            const result = OpenRouterResponseSchema.safeParse(data);

            expect(result.success).toBe(false);
        });
    });

    describe("FlashcardItemSchema", () => {
        it("should parse valid flashcard", () => {
            const data = {
                question: "What is TypeScript?",
                answer: "A typed superset of JavaScript",
                id: "550e8400-e29b-41d4-a716-446655440000",
            };

            const result = FlashcardItemSchema.safeParse(data);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.question).toBe("What is TypeScript?");
            }
        });

        it("should reject empty question", () => {
            const data = {
                question: "",
                answer: "Answer",
                id: "550e8400-e29b-41d4-a716-446655440000",
            };

            const result = FlashcardItemSchema.safeParse(data);

            expect(result.success).toBe(false);
        });

        it("should reject missing id", () => {
            const data = {
                question: "Question",
                answer: "Answer",
            };

            const result = FlashcardItemSchema.safeParse(data);

            expect(result.success).toBe(false);
        });

        it("should reject empty id", () => {
            const data = {
                question: "Question",
                answer: "Answer",
                id: "",
            };

            const result = FlashcardItemSchema.safeParse(data);

            expect(result.success).toBe(false);
        });
    });

    describe("FlashcardChangeTypeSchema", () => {
        it("should accept NEW", () => {
            const result = FlashcardChangeTypeSchema.safeParse("NEW");
            expect(result.success).toBe(true);
        });

        it("should accept MODIFIED", () => {
            const result = FlashcardChangeTypeSchema.safeParse("MODIFIED");
            expect(result.success).toBe(true);
        });

        it("should accept DELETED", () => {
            const result = FlashcardChangeTypeSchema.safeParse("DELETED");
            expect(result.success).toBe(true);
        });

        it("should reject invalid type", () => {
            const result = FlashcardChangeTypeSchema.safeParse("UPDATED");
            expect(result.success).toBe(false);
        });

        it("should reject lowercase", () => {
            const result = FlashcardChangeTypeSchema.safeParse("new");
            expect(result.success).toBe(false);
        });
    });

    describe("DiffResponseSchema", () => {
        it("should parse valid diff response", () => {
            const data = {
                changes: [
                    {
                        type: "NEW",
                        question: "Test",
                        answer: "Answer",
                    },
                ],
            };

            const result = DiffResponseSchema.safeParse(data);

            expect(result.success).toBe(true);
        });

        it("should parse empty changes array", () => {
            const data = {
                changes: [],
            };

            const result = DiffResponseSchema.safeParse(data);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.changes).toHaveLength(0);
            }
        });

        it("should reject missing changes array", () => {
            const data = {};

            const result = DiffResponseSchema.safeParse(data);

            expect(result.success).toBe(false);
        });
    });

    describe("SettingsSchema", () => {
        it("should parse valid settings", () => {
            const data = {
                openRouterApiKey: "sk-test-key",
                aiModel: "google/gemini-3-flash-preview",
                autoSyncToAnki: true,
            };

            const result = SettingsSchema.safeParse(data);

            expect(result.success).toBe(true);
        });

        it("should accept empty API key", () => {
            const data = {
                openRouterApiKey: "",
                aiModel: "google/gemini-3-flash-preview",
                autoSyncToAnki: false,
            };

            const result = SettingsSchema.safeParse(data);

            expect(result.success).toBe(true);
        });

        it("should reject invalid AI model", () => {
            const data = {
                openRouterApiKey: "key",
                aiModel: "invalid-model",
                autoSyncToAnki: false,
            };

            const result = SettingsSchema.safeParse(data);

            expect(result.success).toBe(false);
        });

        it("should use default values", () => {
            const data = {
                openRouterApiKey: "key",
                aiModel: "google/gemini-3-flash-preview",
            };

            const result = SettingsSchema.safeParse(data);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.autoSyncToAnki).toBe(false);
            }
        });
    });
});
