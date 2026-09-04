import type { AssistantContext } from "@true-recall/core/ai/assistant";
import type { SemanticGradingResult } from "@true-recall/core/types";

import {
	type AssistantContextCard,
	assistantContextFromCard,
} from "@true-recall/obsidian/features/assistant/ui/ai-context-source";

/** Snapshot of the current type-in attempt used to seed a follow-up question. */
export interface ReviewFollowUpAttempt {
	typedAnswer: string;
	semanticResult: SemanticGradingResult | null;
}

/** Builds the assistant context for a follow-up question asked right after a
 * type-in answer was graded: the card plus the attempt and its verdict. */
export function buildReviewFollowUpContext(
	card: AssistantContextCard,
	attempt: ReviewFollowUpAttempt,
): AssistantContext {
	const context = assistantContextFromCard(card);
	context.reviewAttempt = {
		typedAnswer: attempt.typedAnswer.trim(),
		...(attempt.semanticResult
			? {
					verdict: attempt.semanticResult.verdict,
					teacherComment: attempt.semanticResult.teacherComment,
					covered: attempt.semanticResult.covered,
					missing: attempt.semanticResult.missing,
					errors: attempt.semanticResult.errors,
				}
			: {}),
	};
	return context;
}
