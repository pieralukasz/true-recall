import { describe, expect, it } from "vitest";
import {
	deriveTypeInMode,
	isRatingLockedForTypeIn,
	isTypeInRequiredForCard,
	nextTypeInMode,
	shouldRunAIGradingOnReveal,
} from "../../../src/features/study/ui/review/helpers/type-in-flow";
import type { FSRSFlashcardItem } from "../../../src/shared/types";

function createCard(
	answer: string,
	cardType: FSRSFlashcardItem["cardType"] = "basic",
): FSRSFlashcardItem {
	return {
		id: "card-1",
		question: "Q",
		answer,
		cardType,
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
	it("derives mode from enabled + AI flags", () => {
		expect(deriveTypeInMode(false, false)).toBe("off");
		expect(deriveTypeInMode(false, true)).toBe("off");
		expect(deriveTypeInMode(true, true)).toBe("ai");
		expect(deriveTypeInMode(true, false)).toBe("diff");
	});

	it("cycles modes in fixed order", () => {
		expect(nextTypeInMode("off")).toBe("ai");
		expect(nextTypeInMode("ai")).toBe("diff");
		expect(nextTypeInMode("diff")).toBe("off");
	});

	it("requires type-in only when mode is enabled and card has text answer", () => {
		expect(isTypeInRequiredForCard(createCard("A"), true)).toBe(true);
		expect(isTypeInRequiredForCard(createCard(""), true)).toBe(false);
		expect(isTypeInRequiredForCard(createCard("A"), false)).toBe(false);
		expect(
			isTypeInRequiredForCard(
				createCard("Reveal image occlusion", "image-occlusion"),
				true,
			),
		).toBe(false);
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
