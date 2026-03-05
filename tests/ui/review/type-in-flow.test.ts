import { describe, expect, it } from "vitest";
import {
	isRatingLockedForTypeIn,
	isTypeInRequiredForCard,
	shouldRunAIGradingOnReveal,
} from "../../../src/features/study/ui/review/helpers/type-in-flow";
import type { FSRSFlashcardItem } from "../../../src/shared/types";

function createCard(answer: string): FSRSFlashcardItem {
	return {
		id: "card-1",
		question: "Q",
		answer,
		fsrs: {
			id: "card-1",
			due: new Date().toISOString(),
			stability: 0,
			difficulty: 0,
			reps: 0,
			lapses: 0,
			state: 0,
			lastReview: null,
			scheduledDays: 0,
			learningStep: 0,
		},
	};
}

describe("type-in flow helpers", () => {
	it("requires type-in only when mode is enabled and card has text answer", () => {
		expect(isTypeInRequiredForCard(createCard("A"), true)).toBe(true);
		expect(isTypeInRequiredForCard(createCard(""), true)).toBe(false);
		expect(isTypeInRequiredForCard(createCard("A"), false)).toBe(false);
	});

	it("runs AI grading only when AI is enabled and typed answer is non-empty", () => {
		expect(
			shouldRunAIGradingOnReveal({
				requiresTypeIn: true,
				aiEnabled: true,
				typedAnswer: "answer",
				isChecking: false,
			}),
		).toBe(true);

		expect(
			shouldRunAIGradingOnReveal({
				requiresTypeIn: true,
				aiEnabled: true,
				typedAnswer: "  ",
				isChecking: false,
			}),
		).toBe(false);

		expect(
			shouldRunAIGradingOnReveal({
				requiresTypeIn: true,
				aiEnabled: false,
				typedAnswer: "answer",
				isChecking: false,
			}),
		).toBe(false);

		expect(
			shouldRunAIGradingOnReveal({
				requiresTypeIn: true,
				aiEnabled: true,
				typedAnswer: "answer",
				isChecking: true,
			}),
		).toBe(false);
	});

	it("locks ratings only while AI grading is in progress after reveal", () => {
		expect(
			isRatingLockedForTypeIn({
				requiresTypeIn: true,
				isAnswerRevealed: false,
				isChecking: false,
			}),
		).toBe(false);

		expect(
			isRatingLockedForTypeIn({
				requiresTypeIn: true,
				isAnswerRevealed: true,
				isChecking: true,
			}),
		).toBe(true);

		expect(
			isRatingLockedForTypeIn({
				requiresTypeIn: true,
				isAnswerRevealed: true,
				isChecking: false,
			}),
		).toBe(false);
	});
});
