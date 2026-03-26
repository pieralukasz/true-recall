import { describe, it, expect } from "vitest";
import {
    FlashcardItemSchema,
    SettingsSchema,
} from "../../src/shared/validation/schemas";

describe("Zod Schemas", () => {
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

        it("should accept any string as AI model", () => {
            const data = {
                openRouterApiKey: "key",
                aiModel: "custom/some-model",
                autoSyncToAnki: false,
            };

            const result = SettingsSchema.safeParse(data);

            expect(result.success).toBe(true);
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
