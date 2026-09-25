import type { CardMutation } from "@true-recall/obsidian/services/signals";

/**
 * Decide whether a data change needs a full panel reload.
 *
 * Answering a card during review only changes FSRS scheduling data, so the
 * reload is skipped while the panel follows the review. Other mutations (for
 * example card polish or edits) change question/answer content and reload
 * even while following a review.
 */
export function shouldReloadPanel(
	mutation: CardMutation | null,
	isFollowingReview: boolean,
): boolean {
	const isReviewRating = mutation?.type === "reviewed";
	return !isReviewRating || !isFollowingReview;
}
