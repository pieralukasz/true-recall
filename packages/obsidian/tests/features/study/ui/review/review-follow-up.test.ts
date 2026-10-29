import { describe, expect, it } from "vitest";

import type { SemanticGradingResult } from "@true-recall/core/types";

import type { AssistantContextCard } from "../../../../../src/features/assistant/ui/ai-context-source";
import {
	buildReviewFollowUpContext,
	followUpPlaceholder,
	hasGradingGaps,
	revealBelowDelta,
	revealedReviewAttempt,
} from "../../../../../src/features/study/ui/review/helpers/review-follow-up";
import { getCardColumnMaxWidth } from "../../../../../src/features/study/ui/review/helpers/review-width";
import en from "../../../../../src/i18n/locales/en.json";
import zhCN from "../../../../../src/i18n/locales/zh-CN.json";

const CARD: AssistantContextCard = {
	id: "card-1",
	noteId: "note-1",
	question: "What is **TCP**?",
	answer: "A connection-oriented transport protocol",
	sourceUid: "uid-1",
	sourceNotePath: "Net/TCP.md",
	fsrs: { noteTypeId: "builtin-basic" },
};

const RESULT: SemanticGradingResult = {
	verdict: "partial",
	teacherComment: "Half right.",
	covered: ["transport layer"],
	missing: ["connection-oriented"],
	errors: [],
	suggestedRating: "hard",
};

describe("buildReviewFollowUpContext", () => {
	it("carries the card and the graded attempt", () => {
		const context = buildReviewFollowUpContext(CARD, {
			typedAnswer: "  a transport thing  ",
			semanticResult: RESULT,
		});

		expect(context.card?.cardId).toBe("card-1");
		expect(context.activeNotePath).toBe("Net/TCP.md");
		expect(context.reviewAttempt).toEqual({
			typedAnswer: "a transport thing",
			verdict: "partial",
			teacherComment: "Half right.",
			covered: ["transport layer"],
			missing: ["connection-oriented"],
			errors: [],
		});
	});

	it("omits grading fields when semantic grading did not run", () => {
		const context = buildReviewFollowUpContext(CARD, {
			typedAnswer: "guess",
			semanticResult: null,
		});

		expect(context.reviewAttempt).toEqual({ typedAnswer: "guess" });
	});
});

describe("revealedReviewAttempt", () => {
	it("gives the typed answer and grading once the answer is revealed", () => {
		expect(
			revealedReviewAttempt(
				{ typedAnswer: " a transport thing ", semanticResult: RESULT },
				true,
			),
		).toEqual({
			typedAnswer: "a transport thing",
			verdict: "partial",
			teacherComment: "Half right.",
			covered: ["transport layer"],
			missing: ["connection-oriented"],
			errors: [],
		});
	});

	it("gives nothing before the reveal or without a typed answer", () => {
		expect(
			revealedReviewAttempt(
				{ typedAnswer: "guess", semanticResult: RESULT },
				false,
			),
		).toBeUndefined();
		expect(
			revealedReviewAttempt({ typedAnswer: "   ", semanticResult: null }, true),
		).toBeUndefined();
	});
});

describe("hasGradingGaps", () => {
	it("shows Cards from gaps when something was missed or wrong", () => {
		expect(hasGradingGaps(RESULT)).toBe(true);
		expect(hasGradingGaps({ missing: [], errors: ["U = R"] })).toBe(true);
	});

	it("hides it without gaps or without a grading", () => {
		expect(hasGradingGaps({ missing: [], errors: [] })).toBe(false);
		expect(hasGradingGaps({ missing: ["  "], errors: [""] })).toBe(false);
		expect(hasGradingGaps(null)).toBe(false);
		expect(hasGradingGaps(undefined)).toBe(false);
	});
});

describe("followUpPlaceholder", () => {
	it("says the AI chat answers about the typed answer right away", () => {
		expect(followUpPlaceholder(true)).toBe("Ask AI about your answer…");
	});

	it("keeps the queued wording for the old assistant", () => {
		expect(followUpPlaceholder(false)).toBe(
			"Ask AI a follow-up… (answered after the session)",
		);
	});

	it("returns keys present in both catalogs", () => {
		const catalogs: Record<string, string>[] = [en, zhCN];
		for (const key of [followUpPlaceholder(true), followUpPlaceholder(false)]) {
			for (const catalog of catalogs) expect(catalog[key], key).toBeTruthy();
		}
	});
});

describe("revealBelowDelta", () => {
	it("scrolls down by how much the grading ends below the card area", () => {
		expect(revealBelowDelta({ bottom: 520.2 }, { bottom: 400 })).toBe(121);
	});

	it("never scrolls when the grading is already in view, or up", () => {
		expect(revealBelowDelta({ bottom: 400 }, { bottom: 400 })).toBe(0);
		expect(revealBelowDelta({ bottom: 120 }, { bottom: 400 })).toBe(0);
	});
});

describe("getCardColumnMaxWidth", () => {
	const card = { question: "Q", answer: "A" };

	it("follows the review width setting on desktop", () => {
		expect(getCardColumnMaxWidth(card, "default", false)).toBe("48rem");
		expect(getCardColumnMaxWidth(card, "wide", false)).toBe("64rem");
	});

	it("is the full width on phones and for handwriting embeds", () => {
		expect(getCardColumnMaxWidth(card, "default", true)).toBe("100%");
		expect(
			getCardColumnMaxWidth(
				{ question: "![InkDrawing](x.svg)", answer: "A" },
				"narrow",
				false,
			),
		).toBe("100%");
	});
});
