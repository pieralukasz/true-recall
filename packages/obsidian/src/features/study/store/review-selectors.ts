import { Rating, State } from "ts-fsrs";

import type {
	FSRSFlashcardItem,
	ReviewSessionStats,
} from "@true-recall/core/types";

import type {
	ReviewSliceActions,
	SessionPhase,
} from "@true-recall/obsidian/store/types";

import { isCardDueNow, isPendingLearning } from "./review-queue.engine";
import type { ReviewSliceContext } from "./review-slice-context";
export function createReviewSelectors({
	get,
}: ReviewSliceContext): Pick<
	ReviewSliceActions,
	| "getCurrentCard"
	| "getPhase"
	| "getBadgeCounts"
	| "getStats"
	| "getProgress"
	| "getRemainingCount"
	| "isCardDueNow"
	| "getPendingLearningCards"
	| "getTimeUntilNextDue"
	| "isWaitingForLearningCards"
	| "isComplete"
	| "isActiveSession"
	| "isAnswerShown"
> {
	return {
		getCurrentCard: () => {
			const state = get().review;
			if (!state.isActive || state.currentIndex >= state.queue.length) {
				return null;
			}
			return state.queue[state.currentIndex] ?? null;
		},

		getPhase: (): SessionPhase => {
			const state = get().review;

			if (!state.isActive) {
				if (state.results.length > 0) {
					return { type: "complete", stats: get().review.getStats() };
				}
				return { type: "idle" };
			}

			if (state.currentIndex >= state.queue.length) {
				return { type: "complete", stats: get().review.getStats() };
			}

			const currentCard = state.queue[state.currentIndex];
			if (currentCard) {
				// Every queue mutation promotes an actionable card to the cursor,
				// so a pending card here means nothing is reviewable right now.
				if (isPendingLearning(currentCard)) {
					return {
						type: "waiting",
						timeUntilDue: get().review.getTimeUntilNextDue(),
					};
				}
				return { type: "active", card: currentCard };
			}

			return { type: "idle" };
		},

		getBadgeCounts: () => ({ ...get().review.cachedBadgeCounts }),

		getStats: (): ReviewSessionStats => {
			const state = get().review;
			const results = state.results;
			return {
				total: state.queue.length,
				reviewed: results.length,
				again: results.filter((r) => r.rating === Rating.Again).length,
				hard: results.filter((r) => r.rating === Rating.Hard).length,
				good: results.filter((r) => r.rating === Rating.Good).length,
				easy: results.filter((r) => r.rating === Rating.Easy).length,
				newCards: results.filter((r) => r.previousState === State.New).length,
				learningCards: results.filter(
					(r) =>
						r.previousState === State.Learning ||
						r.previousState === State.Relearning,
				).length,
				reviewCards: results.filter((r) => r.previousState === State.Review)
					.length,
				duration: state.isActive
					? Date.now() - state.startTime
					: state.stats.duration,
			};
		},

		getProgress: () => {
			const state = get().review;
			const current = Math.min(state.currentIndex + 1, state.queue.length);
			const total = state.queue.length;
			const percentage = total > 0 ? (current / total) * 100 : 0;
			return { current, total, percentage };
		},

		getRemainingCount: () => {
			const state = get().review;
			return Math.max(0, state.queue.length - state.currentIndex);
		},

		isCardDueNow: (card: FSRSFlashcardItem) => isCardDueNow(card),

		getPendingLearningCards: () => {
			const state = get().review;
			return state.queue
				.slice(state.currentIndex)
				.filter((card) => isPendingLearning(card));
		},

		getTimeUntilNextDue: () => {
			const pending = get().review.getPendingLearningCards();
			if (pending.length === 0) return 0;

			const now = Date.now();
			let soonest = Infinity;

			for (const card of pending) {
				const dueTime = new Date(card.fsrs.due).getTime();
				const timeUntil = dueTime - now;
				if (timeUntil > 0 && timeUntil < soonest) {
					soonest = timeUntil;
				}
			}

			return soonest === Infinity ? 0 : soonest;
		},

		isWaitingForLearningCards: () => {
			const state = get().review;
			if (!state.isActive) return false;

			const currentCard = state.queue[state.currentIndex];
			if (!currentCard) return false;
			if (!isPendingLearning(currentCard)) return false;

			const MAX_WAIT_MS = 60 * 60 * 1000;
			const timeUntilDue = get().review.getTimeUntilNextDue();
			return timeUntilDue <= MAX_WAIT_MS;
		},

		isComplete: () => {
			const state = get().review;
			return state.isActive && state.currentIndex >= state.queue.length;
		},

		isActiveSession: () => get().review.isActive,

		isAnswerShown: () => get().review.isAnswerRevealed,
	};
}
