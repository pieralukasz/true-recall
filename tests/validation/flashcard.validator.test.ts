import { describe, it, expect } from "vitest";
import {
	validateFlashcardChange,
	safeValidateFlashcardChange,
	validateDiffResponse,
	parseDiffJson,
	validateFlashcardItem,
	validateFlashcardItems,
	enrichFlashcardChanges,
} from "../../src/validation/flashcard.validator";
import { ValidationError } from "../../src/errors";

describe("Flashcard Validator", () => {
	describe("validateFlashcardChange", () => {
		it("should validate NEW flashcard change", () => {
			const change = {
				type: "NEW",
				question: "What is TypeScript?",
				answer: "A typed superset of JavaScript",
			};

			const result = validateFlashcardChange(change);

			expect(result.type).toBe("NEW");
			expect(result.question).toBe("What is TypeScript?");
			expect(result.accepted).toBe(true); // NEW defaults to accepted
		});

		it("should validate MODIFIED flashcard change", () => {
			const change = {
				type: "MODIFIED",
				question: "What is **[[TypeScript]]**?",
				answer: "A typed superset of JavaScript",
				originalQuestion: "What is TypeScript?",
			};

			const result = validateFlashcardChange(change);

			expect(result.type).toBe("MODIFIED");
			expect(result.accepted).toBe(false); // MODIFIED defaults to not accepted
		});

		it("should validate DELETED flashcard change", () => {
			const change = {
				type: "DELETED",
				question: "What is TypeScript?",
				answer: "A typed superset of JavaScript",
				originalQuestion: "What is TypeScript?",
				reason: "Content no longer in note",
			};

			const result = validateFlashcardChange(change);

			expect(result.type).toBe("DELETED");
			expect(result.reason).toBe("Content no longer in note");
			expect(result.accepted).toBe(false); // DELETED defaults to not accepted
		});

		it("should throw for invalid change type", () => {
			const change = {
				type: "INVALID",
				question: "Test",
				answer: "Test",
			};

			expect(() => validateFlashcardChange(change)).toThrow(
				ValidationError
			);
		});

		it("should use default empty strings for missing question/answer", () => {
			const change = {
				type: "NEW",
			};

			const result = validateFlashcardChange(change);

			expect(result.question).toBe("");
			expect(result.answer).toBe("");
		});
	});

	describe("safeValidateFlashcardChange", () => {
		it("should return validated change for valid input", () => {
			const change = {
				type: "NEW",
				question: "Test question",
				answer: "Test answer",
			};

			const result = safeValidateFlashcardChange(change);

			expect(result).not.toBeNull();
			expect(result?.type).toBe("NEW");
		});

		it("should return null for invalid input", () => {
			const change = {
				type: "INVALID_TYPE",
			};

			const result = safeValidateFlashcardChange(change);

			expect(result).toBeNull();
		});
	});

	describe("validateDiffResponse", () => {
		it("should validate diff response with changes", () => {
			const response = {
				changes: [
					{
						type: "NEW",
						question: "Question 1",
						answer: "Answer 1",
					},
					{
						type: "MODIFIED",
						question: "Question 2",
						answer: "Answer 2",
						originalQuestion: "Old question",
					},
				],
			};

			const result = validateDiffResponse(response);

			expect(result).toHaveLength(2);
			expect(result[0].type).toBe("NEW");
			expect(result[1].type).toBe("MODIFIED");
		});

		it("should return empty array for invalid response", () => {
			const response = { invalid: true };

			const result = validateDiffResponse(response);

			expect(result).toEqual([]);
		});

		it("should filter out invalid changes", () => {
			const response = {
				changes: [
					{
						type: "NEW",
						question: "Valid question",
						answer: "Valid answer",
					},
					{
						type: "INVALID",
						question: "Invalid",
					},
				],
			};

			const result = validateDiffResponse(response);

			expect(result).toHaveLength(1);
			expect(result[0].question).toBe("Valid question");
		});
	});

	describe("parseDiffJson", () => {
		it("should parse valid JSON with changes", () => {
			const json = JSON.stringify({
				changes: [
					{
						type: "NEW",
						question: "Test",
						answer: "Test answer",
					},
				],
			});

			const result = parseDiffJson(json);

			expect(result).toHaveLength(1);
		});

		it("should extract JSON from text with surrounding content", () => {
			const response = `Here's the analysis:

            {"changes": [{"type": "NEW", "question": "Test", "answer": "Answer"}]}

            Let me know if you need anything else.`;

			const result = parseDiffJson(response);

			expect(result).toHaveLength(1);
		});

		it("should return empty array for NO_NEW_CARDS response", () => {
			const response = "NO_NEW_CARDS";

			const result = parseDiffJson(response);

			expect(result).toEqual([]);
		});

		it("should return empty array for invalid JSON", () => {
			const response = "This is not JSON";

			const result = parseDiffJson(response);

			expect(result).toEqual([]);
		});

		it("should return empty array for malformed JSON", () => {
			const response = "{ invalid json }";

			const result = parseDiffJson(response);

			expect(result).toEqual([]);
		});
	});

	describe("validateFlashcardItem", () => {
		it("should validate a valid flashcard item", () => {
			const item = {
				question: "What is Zod?",
				answer: "A TypeScript-first schema validation library",
				lineNumber: 10,
			};

			const result = validateFlashcardItem(item);

			expect(result.question).toBe("What is Zod?");
		});

		it("should throw for empty question", () => {
			const item = {
				question: "",
				answer: "Answer",
				lineNumber: 1,
			};

			expect(() => validateFlashcardItem(item)).toThrow(ValidationError);
		});

		it("should throw for negative line number", () => {
			const item = {
				question: "Question",
				answer: "Answer",
				lineNumber: -1,
			};

			expect(() => validateFlashcardItem(item)).toThrow(ValidationError);
		});
	});

	describe("validateFlashcardItems", () => {
		it("should validate array of items", () => {
			const items = [
				{ question: "Q1", answer: "A1", lineNumber: 1 },
				{ question: "Q2", answer: "A2", lineNumber: 5 },
			];

			const result = validateFlashcardItems(items);

			expect(result).toHaveLength(2);
		});

		it("should filter out invalid items", () => {
			const items = [
				{
					question: "Valid",
					answer: "Valid",
					lineNumber: 1,
				},
				{
					question: "",
					answer: "Invalid",
					lineNumber: 2,
				},
			];

			const result = validateFlashcardItems(items);

			expect(result).toHaveLength(1);
			expect(result[0].question).toBe("Valid");
		});
	});

	describe("enrichFlashcardChanges", () => {
		const existingFlashcards = [
			{
				question: "Original question",
				answer: "Original answer",
				lineNumber: 10,
			},
			{
				question: "Another question",
				answer: "Another answer",
				lineNumber: 20,
			},
		];

		it("should enrich MODIFIED change with original data", () => {
			const changes = [
				{
					type: "MODIFIED" as const,
					question: "Improved question",
					answer: "Improved answer",
					originalQuestion: "Original question",
				},
			];

			const result = enrichFlashcardChanges(changes, existingFlashcards);

			expect(result[0].originalAnswer).toBe("Original answer");
			expect(result[0].originalLineNumber).toBe(10);
		});

		it("should enrich DELETED change with original data", () => {
			const changes = [
				{
					type: "DELETED" as const,
					question: "",
					answer: "",
					originalQuestion: "Original question",
					reason: "No longer relevant",
				},
			];

			const result = enrichFlashcardChanges(changes, existingFlashcards);

			expect(result[0].question).toBe("Original question");
			expect(result[0].answer).toBe("Original answer");
			expect(result[0].originalLineNumber).toBe(10);
		});

		it("should set accepted=true for NEW changes", () => {
			const changes = [
				{
					type: "NEW" as const,
					question: "New question",
					answer: "New answer",
				},
			];

			const result = enrichFlashcardChanges(changes, existingFlashcards);

			expect(result[0].accepted).toBe(true);
		});

		it("should set accepted=false for MODIFIED/DELETED changes", () => {
			const changes = [
				{
					type: "MODIFIED" as const,
					question: "Modified",
					answer: "Answer",
					originalQuestion: "Original question",
				},
				{
					type: "DELETED" as const,
					question: "",
					answer: "",
					originalQuestion: "Another question",
				},
			];

			const result = enrichFlashcardChanges(changes, existingFlashcards);

			expect(result[0].accepted).toBe(false);
			expect(result[1].accepted).toBe(false);
		});
	});
});
