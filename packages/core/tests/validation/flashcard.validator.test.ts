import { describe, expect, it } from "vitest";

import { ValidationError } from "../../src/errors";
import {
	validateFlashcardItem,
	validateFlashcardItems,
} from "../../src/validation/flashcard.validator";

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

		it("should normalize missing cardType to basic", () => {
			const item = {
				question: "Q",
				answer: "A",
				id: "id-1",
			};

			const result = validateFlashcardItem(item);

			expect(result).toBeDefined();
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

		it("should validate cloze card with required fields", () => {
			const item = {
				question: "France is in [...]",
				answer: "Europe",
				id: "cloze-1",
				cardType: "cloze",
				clozeTemplate: "{{c1::France}} is in {{c2::Europe}}",
				clozeIndex: 1,
			};

			const result = validateFlashcardItem(item);

			expect(result.question).toBe("France is in [...]");
		});

		it("should throw for cloze card missing clozeTemplate", () => {
			const item = {
				question: "France is in [...]",
				answer: "Europe",
				id: "cloze-1",
				cardType: "cloze",
				clozeIndex: 1,
			};

			expect(() => validateFlashcardItem(item)).toThrow(ValidationError);
		});

		it("should validate reversed card", () => {
			const item = {
				question: "Europe",
				answer: "What continent?",
				id: "rev-1",
				cardType: "reversed",
				reverseOfBatchId: "orig-1",
			};

			const result = validateFlashcardItem(item);

			expect(result.question).toBe("Europe");
		});

		it("should validate image-occlusion card", () => {
			const item = {
				question: "What is highlighted?",
				answer: "Heart",
				id: "io-1",
				cardType: "image-occlusion",
			};

			const result = validateFlashcardItem(item);

			expect(result.question).toBe("What is highlighted?");
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

		it("should filter out cloze cards missing required fields", () => {
			const items = [
				{
					question: "Valid basic",
					answer: "A",
					id: "id-1",
					cardType: "basic",
				},
				{
					question: "Bad cloze",
					answer: "A",
					id: "id-2",
					cardType: "cloze",
					// missing clozeTemplate and clozeIndex
				},
			];

			const result = validateFlashcardItems(items);

			expect(result).toHaveLength(1);
			expect(result[0].question).toBe("Valid basic");
		});
	});
});
