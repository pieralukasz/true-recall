import { describe, expect, it } from "vitest";

import {
	DEFAULT_ANSWER_SECONDS,
	MIN_ANSWER_SECONDS,
	suggestedAnswerSeconds,
} from "@true-recall/obsidian/features/study/ui/review/helpers/answer-time-budget";

function card(
	answer: string,
	fsrs: { reps?: number; difficulty?: number } = {},
) {
	return { answer, fsrs };
}

/** Default weights: 3s per 40 characters, up to +50% from difficulty. */
describe("suggestedAnswerSeconds", () => {
	it("returns the base time for an empty answer without history", () => {
		expect(suggestedAnswerSeconds(card(""), DEFAULT_ANSWER_SECONDS)).toBe(20);
	});

	it("adds 3s for every 40 characters of answer", () => {
		expect(suggestedAnswerSeconds(card("x".repeat(40)), 20)).toBe(23);
		expect(suggestedAnswerSeconds(card("x".repeat(400)), 20)).toBe(50);
		expect(suggestedAnswerSeconds(card("x".repeat(4000)), 20)).toBe(320);
	});

	it("gives cards with a bad rating history more time and known cards less", () => {
		expect(suggestedAnswerSeconds(card("", { reps: 6, difficulty: 10 }), 20)).toBe(
			30,
		);
		expect(suggestedAnswerSeconds(card("", { reps: 6, difficulty: 1 }), 20)).toBe(
			16,
		);
	});

	it("applies the difficulty factor on top of the length bonus", () => {
		// 400 characters = 30s of reading, then +50% for difficulty 10.
		expect(
			suggestedAnswerSeconds(card("x".repeat(400), { reps: 9, difficulty: 10 }), 20),
		).toBe(75);
	});

	it("ignores difficulty before the first review", () => {
		expect(
			suggestedAnswerSeconds(card("", { reps: 0, difficulty: 10 }), 20),
		).toBe(20);
	});

	it("ignores a dimension whose weight is 0", () => {
		expect(
			suggestedAnswerSeconds(
				card("x".repeat(4000), { reps: 9, difficulty: 10 }),
				20,
				{ secondsPerChunk: 0, historyWeight: 0 },
			),
		).toBe(20);
	});

	it("uses the configured seconds per chunk", () => {
		expect(
			suggestedAnswerSeconds(card("x".repeat(400)), 20, {
				secondsPerChunk: 1,
				historyWeight: 0,
			}),
		).toBe(30);
	});

	it("never drops below the minimum and never exceeds the safety cap", () => {
		expect(suggestedAnswerSeconds(card(""), 1)).toBe(MIN_ANSWER_SECONDS);
		expect(
			suggestedAnswerSeconds(card("x".repeat(20000)), 20, {
				secondsPerChunk: 10,
			}),
		).toBe(600);
	});

	it("ignores html tags when measuring the answer", () => {
		expect(suggestedAnswerSeconds(card("<div></div>"), 20)).toBe(20);
	});
});
