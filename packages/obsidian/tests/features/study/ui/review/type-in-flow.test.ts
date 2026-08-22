import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import type { FSRSFlashcardItem } from "@true-recall/core/types";

import {
	deriveTypeInMode,
	isRatingLockedForTypeIn,
	isTypeInRequiredForCard,
	nextTypeInMode,
	shouldRunAIGradingOnReveal,
	suggestedRatingToGrade,
} from "../../../../../src/features/study/ui/review/helpers/type-in-flow";

function createCard(
	answer: string,
	cardType: FSRSFlashcardItem["cardType"] = "basic",
	alwaysTypeIn = false,
): FSRSFlashcardItem {
	return {
		id: "card-1",
		question: "Q",
		answer,
		cardType,
		alwaysTypeIn,
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
			alwaysTypeIn,
		},
	};
}

describe("type-in flow helpers", () => {
	it("derives mode from the enabled flag", () => {
		expect(deriveTypeInMode(false)).toBe("off");
		expect(deriveTypeInMode(true)).toBe("ai");
	});

	it("toggles between off and ai", () => {
		expect(nextTypeInMode("off")).toBe("ai");
		expect(nextTypeInMode("ai")).toBe("off");
	});

	it("stays on ai when off is skipped (always-type-in cards)", () => {
		expect(nextTypeInMode("ai", true)).toBe("ai");
		expect(nextTypeInMode("off", true)).toBe("ai");
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

	it("requires type-in for always-type-in cards even when mode is off", () => {
		expect(isTypeInRequiredForCard(createCard("A", "basic", true), false)).toBe(
			true,
		);
	});

	it("runs AI grading only for a non-empty typed answer", () => {
		expect(
			shouldRunAIGradingOnReveal({
				requiresTypeIn: true,
				typedAnswer: "answer",
				isChecking: false,
			}),
		).toBe(true);

		expect(
			shouldRunAIGradingOnReveal({
				requiresTypeIn: true,
				typedAnswer: "  ",
				isChecking: false,
			}),
		).toBe(false);

		expect(
			shouldRunAIGradingOnReveal({
				requiresTypeIn: false,
				typedAnswer: "answer",
				isChecking: false,
			}),
		).toBe(false);

		expect(
			shouldRunAIGradingOnReveal({
				requiresTypeIn: true,
				typedAnswer: "answer",
				isChecking: true,
			}),
		).toBe(false);
	});

	it("locks ratings while grading is in progress, revealed or not", () => {
		// Checking now happens BEFORE reveal (two-stage flow), so the lock
		// must hold in both phases.
		expect(
			isRatingLockedForTypeIn({
				requiresTypeIn: true,
				isAnswerRevealed: false,
				isChecking: true,
			}),
		).toBe(true);

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

		expect(
			isRatingLockedForTypeIn({
				requiresTypeIn: false,
				isAnswerRevealed: true,
				isChecking: true,
			}),
		).toBe(false);
	});

	it.each([
		["again", Rating.Again],
		["hard", Rating.Hard],
		["good", Rating.Good],
		["easy", Rating.Easy],
	] as const)("maps suggested rating %s to grade", (suggested, grade) => {
		expect(suggestedRatingToGrade(suggested)).toBe(grade);
	});

	it("maps missing suggestion to null", () => {
		expect(suggestedRatingToGrade(null)).toBeNull();
		expect(suggestedRatingToGrade(undefined)).toBeNull();
	});
});
