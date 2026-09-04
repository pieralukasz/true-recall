import { describe, expect, it } from "vitest";

import type { SemanticGradingResult } from "@true-recall/core/types";

import type { AssistantContextCard } from "../../../../../src/features/assistant/ui/ai-context-source";
import { buildReviewFollowUpContext } from "../../../../../src/features/study/ui/review/helpers/review-follow-up";

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
