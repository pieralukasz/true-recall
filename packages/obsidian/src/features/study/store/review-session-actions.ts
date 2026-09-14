import type { FSRSFlashcardItem } from "@true-recall/core/types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";

import type { ReviewSliceActions } from "@true-recall/obsidian/store/types";

import { countBadges, promoteActionableCard } from "./review-queue.engine";
import type { ReviewSliceContext } from "./review-slice-context";
import {
	createDefaultStats,
	createInitialState,
	INITIAL_EDIT_MODE,
} from "./review-state";
export function createReviewSessionActions({
	set,
	get,
	clearPreview,
}: ReviewSliceContext): Pick<
	ReviewSliceActions,
	| "startSession"
	| "endSession"
	| "reset"
	| "setSessionFilters"
	| "getSessionFilters"
	| "revealAnswer"
	| "hideAnswer"
> {
	return {
		startSession: (queue: FSRSFlashcardItem[]) => {
			const promoted = promoteActionableCard({
				queue: [...queue],
				currentIndex: 0,
			});
			clearPreview();

			set((s) => ({
				review: {
					...s.review,
					isActive: true,
					queue: promoted.queue,
					currentIndex: 0,
					isAnswerRevealed: false,
					results: [],
					startTime: Date.now(),
					questionShownTime: Date.now(),
					stats: {
						...createDefaultStats(),
						total: queue.length,
					},
					cachedBadgeCounts: countBadges(promoted.queue, 0),
				},
			}));
		},

		endSession: () => {
			clearPreview();
			set((s) => ({
				review: {
					...s.review,
					isActive: false,
					editMode: { ...INITIAL_EDIT_MODE },
					stats: {
						...s.review.stats,
						duration: Date.now() - s.review.startTime,
					},
				},
			}));
		},

		reset: () => {
			clearPreview();
			const initialState = createInitialState();
			set((s) => ({
				review: {
					...s.review,
					...initialState,
				},
			}));
		},

		setSessionFilters: (filters: SessionFilters) => {
			set((s) => ({
				review: {
					...s.review,
					sessionFilters: { ...filters },
				},
			}));
		},

		getSessionFilters: () => ({ ...get().review.sessionFilters }),

		revealAnswer: () => {
			const state = get().review;
			if (!state.isActive || state.isAnswerRevealed) return;

			set((s) => ({
				review: { ...s.review, isAnswerRevealed: true },
			}));
		},

		hideAnswer: () => {
			set((s) => ({
				review: { ...s.review, isAnswerRevealed: false },
			}));
		},
	};
}
