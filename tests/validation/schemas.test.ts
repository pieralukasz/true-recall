import { describe, expect, it } from "vitest";
import { FlashcardItemSchema } from "../../packages/core/src/validation/schemas/flashcard.schema";
import { SettingsSchema } from "../../packages/core/src/validation/schemas/settings.schema";

describe("Zod Schemas", () => {
	describe("FlashcardItemSchema", () => {
		it("should parse valid basic flashcard", () => {
			const data = {
				question: "What is TypeScript?",
				answer: "A typed superset of JavaScript",
				id: "550e8400-e29b-41d4-a716-446655440000",
				cardType: "basic",
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
				cardType: "basic",
			};

			const result = FlashcardItemSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should reject missing id", () => {
			const data = {
				question: "Question",
				answer: "Answer",
				cardType: "basic",
			};

			const result = FlashcardItemSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should reject empty id", () => {
			const data = {
				question: "Question",
				answer: "Answer",
				id: "",
				cardType: "basic",
			};

			const result = FlashcardItemSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should parse valid cloze flashcard", () => {
			const data = {
				question: "France is in [...]",
				answer: "Europe",
				id: "cloze-1",
				cardType: "cloze",
				clozeTemplate: "{{c1::France}} is in {{c2::Europe}}",
				clozeIndex: 1,
			};

			const result = FlashcardItemSchema.safeParse(data);

			expect(result.success).toBe(true);
		});

		it("should reject cloze without clozeTemplate", () => {
			const data = {
				question: "France is in [...]",
				answer: "Europe",
				id: "cloze-1",
				cardType: "cloze",
				clozeIndex: 1,
			};

			const result = FlashcardItemSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should reject cloze without clozeIndex", () => {
			const data = {
				question: "France is in [...]",
				answer: "Europe",
				id: "cloze-1",
				cardType: "cloze",
				clozeTemplate: "{{c1::France}} is in {{c2::Europe}}",
			};

			const result = FlashcardItemSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should parse valid reversed flashcard", () => {
			const data = {
				question: "Europe",
				answer: "What continent is France in?",
				id: "rev-1",
				cardType: "reversed",
				reverseOfBatchId: "orig-1",
			};

			const result = FlashcardItemSchema.safeParse(data);

			expect(result.success).toBe(true);
		});

		it("should parse reversed flashcard without reverseOfBatchId", () => {
			const data = {
				question: "Europe",
				answer: "What continent is France in?",
				id: "rev-1",
				cardType: "reversed",
			};

			const result = FlashcardItemSchema.safeParse(data);

			expect(result.success).toBe(true);
		});

		it("should parse valid image-occlusion flashcard", () => {
			const data = {
				question: "What is highlighted?",
				answer: "The heart",
				id: "io-1",
				cardType: "image-occlusion",
			};

			const result = FlashcardItemSchema.safeParse(data);

			expect(result.success).toBe(true);
		});

		it("should reject without cardType (discriminator required)", () => {
			const data = {
				question: "Question",
				answer: "Answer",
				id: "no-type-1",
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
