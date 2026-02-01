import { describe, it, expect } from "vitest";
import {
	validateFlashcardItem,
	validateFlashcardItems,
} from "../../src/validation/flashcard.validator";
import { ValidationError } from "../../src/errors";

describe("Flashcard Validator", () => {
	describe("validateFlashcardItem", () => {
		it("should validate a valid flashcard item", () => {
			const item = {
				question: "What is Zod?",
				answer: "A TypeScript-first schema validation library",
				id: "550e8400-e29b-41d4-a716-446655440000",
			};

			const result = validateFlashcardItem(item);

			expect(result.question).toBe("What is Zod?");
		});

		it("should throw for empty question", () => {
			const item = {
				question: "",
				answer: "Answer",
				id: "550e8400-e29b-41d4-a716-446655440000",
			};

			expect(() => validateFlashcardItem(item)).toThrow(ValidationError);
		});

		it("should throw for missing id", () => {
			const item = {
				question: "Question",
				answer: "Answer",
			};

			expect(() => validateFlashcardItem(item)).toThrow(ValidationError);
		});
	});

	describe("validateFlashcardItems", () => {
		it("should validate array of items", () => {
			const items = [
				{ question: "Q1", answer: "A1", id: "id-1" },
				{ question: "Q2", answer: "A2", id: "id-2" },
			];

			const result = validateFlashcardItems(items);

			expect(result).toHaveLength(2);
		});

		it("should filter out invalid items", () => {
			const items = [
				{
					question: "Valid",
					answer: "Valid",
					id: "id-1",
				},
				{
					question: "",
					answer: "Invalid",
					id: "id-2",
				},
			];

			const result = validateFlashcardItems(items);

			expect(result).toHaveLength(1);
			expect(result[0].question).toBe("Valid");
		});
	});
});
