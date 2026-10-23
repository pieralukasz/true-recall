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

describe("suggestedAnswerSeconds", () => {
	it("returns the base time for an empty answer without history", () => {
		expect(suggestedAnswerSeconds(card(""), DEFAULT_ANSWER_SECONDS)).toBe(20);
	});

	it("adds time as the answer gets longer, up to the length cap", () => {
		expect(suggestedAnswerSeconds(card("x".repeat(40)), 20)).toBe(22);
		expect(suggestedAnswerSeconds(card("x".repeat(400)), 20)).toBe(35);
		// 4000 characters hit the +75% length ceiling, not 10x.
		expect(suggestedAnswerSeconds(card("x".repeat(4000)), 20)).toBe(35);
	});

	it("gives cards with a bad rating history more time and known cards less", () => {
		expect(suggestedAnswerSeconds(card("", { reps: 6, difficulty: 10 }), 20)).toBe(
			30,
		);
		expect(suggestedAnswerSeconds(card("", { reps: 6, difficulty: 1 }), 20)).toBe(
			16,
		);
	});

	it("ignores difficulty before the first review", () => {
		expect(
			suggestedAnswerSeconds(card("", { reps: 0, difficulty: 10 }), 20),
		).toBe(20);
	});

	it("caps the combined factor and never drops below the minimum", () => {
		expect(
			suggestedAnswerSeconds(
				card("x".repeat(4000), { reps: 9, difficulty: 10 }),
				20,
			),
		).toBe(50);
		expect(suggestedAnswerSeconds(card(""), 1)).toBe(MIN_ANSWER_SECONDS);
	});

	it("ignores html tags when measuring the answer", () => {
		expect(suggestedAnswerSeconds(card("<div></div>"), 20)).toBe(20);
	});
});
