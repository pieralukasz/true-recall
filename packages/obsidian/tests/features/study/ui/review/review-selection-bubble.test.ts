import { describe, expect, it } from "vitest";

import { isAskableSelection } from "@true-recall/obsidian/features/study/ui/review/ReviewSelectionBubble";

const base = {
	text: "prawo Ohma",
	inReviewCard: true,
	inTextInput: false,
	inAiSurface: false,
};

describe("isAskableSelection", () => {
	it("offers Ask AI for text selected on the review card", () => {
		expect(isAskableSelection(base)).toBe(true);
	});

	it("ignores selections shorter than three characters", () => {
		expect(isAskableSelection({ ...base, text: " ab " })).toBe(false);
	});

	it("ignores selections outside the review card", () => {
		expect(isAskableSelection({ ...base, inReviewCard: false })).toBe(false);
	});

	it("ignores text selected in the typed-answer field", () => {
		expect(isAskableSelection({ ...base, inTextInput: true })).toBe(false);
	});

	it("ignores text selected inside an open AI surface", () => {
		expect(isAskableSelection({ ...base, inAiSurface: true })).toBe(false);
	});
});
