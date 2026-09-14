import type { SchedulingPreview } from "@true-recall/core/types";

import type {
	AppState,
	AppStoreDeps,
	ReviewSliceActions,
	ReviewSliceState,
} from "@true-recall/obsidian/store/types";

import { createReviewEditActions } from "./review-edit-actions";
import { countBadges, type QueueSnapshot } from "./review-queue.engine";
import { createReviewQueueActions } from "./review-queue-actions";
import { createReviewSelectors } from "./review-selectors";
import { createReviewSessionActions } from "./review-session-actions";
import type { ReviewSliceContext } from "./review-slice-context";
import { createInitialState } from "./review-state";

type ReviewSlice = ReviewSliceState & ReviewSliceActions;
export function createReviewSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	_deps: AppStoreDeps,
): ReviewSlice {
	// Scheduling preview (ephemeral)
	let schedulingPreview: SchedulingPreview | null = null;

	/**
	 * Commit a queue transition: badge counts are always recomputed from the
	 * snapshot (never patched incrementally), the ephemeral scheduling
	 * preview is dropped, and the cursor card is presented fresh.
	 */
	const commitQueue = (snapshot: QueueSnapshot) => {
		schedulingPreview = null;
		set((s) => ({
			review: {
				...s.review,
				queue: snapshot.queue,
				currentIndex: snapshot.currentIndex,
				isAnswerRevealed: false,
				questionShownTime: Date.now(),
				cachedBadgeCounts: countBadges(snapshot.queue, snapshot.currentIndex),
			},
		}));
	};

	const getSnapshot = (): QueueSnapshot => {
		const state = get().review;
		return { queue: state.queue, currentIndex: state.currentIndex };
	};

	const context: ReviewSliceContext = {
		set,
		get,
		commitQueue,
		getSnapshot,
		clearPreview: () => {
			schedulingPreview = null;
		},
	};
	return {
		...createInitialState(),
		...createReviewSessionActions(context),
		...createReviewQueueActions(context),
		...createReviewEditActions(context),
		...createReviewSelectors(context),
		getSchedulingPreview: () => schedulingPreview,
		setSchedulingPreview: (preview: SchedulingPreview | null) => {
			schedulingPreview = preview;
		},
	};
}
