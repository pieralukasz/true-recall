import type { Grade } from "ts-fsrs";

import type { FSRSFlashcardItem } from "@true-recall/core/types";

import type { ReviewSliceActions } from "@true-recall/obsidian/store/types";

import {
	advanceAfterAnswer,
	countBadges,
	insertAt,
	promoteActionableCard,
	removeAt,
	removeByIds,
} from "./review-queue.engine";
import type { ReviewSliceContext } from "./review-slice-context";
import { buildReviewResult } from "./review-state";
export function createReviewQueueActions({
	set,
	get,
	commitQueue,
	getSnapshot,
}: ReviewSliceContext): Pick<
	ReviewSliceActions,
	| "nextCard"
	| "recordAnswerAndNext"
	| "requeueCard"
	| "removeCurrentCard"
	| "removeCardById"
	| "removeCardsByIds"
	| "addCardToQueue"
	| "addCardsToCurrentSession"
	| "insertCardAtPosition"
	| "replaceQueue"
	| "undoLastAnswer"
> {
	return {
		nextCard: () => {
			const state = get().review;
			if (!state.isActive) return false;

			const nextIndex = state.currentIndex + 1;
			commitQueue({ queue: state.queue, currentIndex: nextIndex });

			return nextIndex < state.queue.length;
		},

		recordAnswerAndNext: (
			rating: Grade,
			updatedCard: FSRSFlashcardItem,
			requeueData?: { card: FSRSFlashcardItem; position: number },
		) => {
			const state = get().review;
			if (!state.isActive) return false;

			const currentCard = state.queue[state.currentIndex];
			if (!currentCard) return false;

			const result = buildReviewResult(
				currentCard,
				rating,
				Date.now() - state.questionShownTime,
			);

			const advanced = advanceAfterAnswer(
				getSnapshot(),
				updatedCard,
				requeueData,
			);

			// ReviewSessionController reads requeueData.position after this call
			// to record where the requeued copy actually landed (undo splices it
			// back out by index), so the caller's object must reflect promotion.
			if (requeueData && advanced.requeuePosition !== undefined) {
				requeueData.position = advanced.requeuePosition;
			}

			set((s) => ({
				review: { ...s.review, results: [...s.review.results, result] },
			}));
			commitQueue(advanced);

			return advanced.currentIndex < advanced.queue.length;
		},

		requeueCard: (card: FSRSFlashcardItem, position?: number) => {
			const state = get().review;
			const inserted = insertAt(
				getSnapshot(),
				card,
				position !== undefined ? position : state.queue.length,
			);

			// No commitQueue: requeueing must not hide a revealed answer or
			// reset the response timer of the card being viewed.
			set((s) => ({
				review: {
					...s.review,
					queue: inserted.queue,
					currentIndex: inserted.currentIndex,
					cachedBadgeCounts: countBadges(inserted.queue, inserted.currentIndex),
				},
			}));
		},

		removeCurrentCard: () => {
			const state = get().review;
			if (!state.isActive) return;

			commitQueue(removeAt(getSnapshot(), state.currentIndex));
		},

		removeCardById: (cardId: string) => {
			const state = get().review;
			if (!state.isActive) return;

			const cardIndex = state.queue.findIndex((c) => c.id === cardId);
			if (cardIndex === -1) return;

			commitQueue(removeAt(getSnapshot(), cardIndex));
		},

		removeCardsByIds: (cardIds: string[]) => {
			const state = get().review;
			if (!state.isActive || cardIds.length === 0) return;

			commitQueue(removeByIds(getSnapshot(), cardIds));
		},

		addCardToQueue: (card: FSRSFlashcardItem) => {
			const state = get().review;
			if (!state.isActive) return;
			if (state.queue.some((c) => c.id === card.id)) return;

			// No commitQueue: appending must not disturb the card being viewed.
			const queue = [...state.queue, card];
			set((s) => ({
				review: {
					...s.review,
					queue,
					cachedBadgeCounts: countBadges(queue, s.review.currentIndex),
				},
			}));
		},

		addCardsToCurrentSession: (cards: FSRSFlashcardItem[]) => {
			const state = get().review;
			if (!state.isActive || cards.length === 0) return 0;

			const queuedIds = new Set(state.queue.map((card) => card.id));
			const addedIds = new Set<string>();
			const uniqueCards = cards.filter((card) => {
				if (queuedIds.has(card.id) || addedIds.has(card.id)) return false;
				addedIds.add(card.id);
				return true;
			});
			if (uniqueCards.length === 0) return 0;

			const queue = [...state.queue];
			queue.splice(state.currentIndex, 0, ...uniqueCards);
			commitQueue(
				promoteActionableCard({ queue, currentIndex: state.currentIndex }),
			);
			return uniqueCards.length;
		},

		insertCardAtPosition: (card: FSRSFlashcardItem, position: number) => {
			const state = get().review;
			if (!state.isActive) return;

			// Inserting at the cursor puts the new card under it (used by undo
			// to restore the active card); inserting before it shifts the cursor
			// so the user stays on the same card. Both handled by the engine.
			commitQueue(insertAt(getSnapshot(), card, position));
		},

		replaceQueue: (
			queue: FSRSFlashcardItem[],
			currentCardId?: string | null,
		) => {
			const state = get().review;
			if (!state.isActive) return;

			const matchedIndex = currentCardId
				? queue.findIndex((card) => card.id === currentCardId)
				: -1;
			const sameCardPreserved = matchedIndex >= 0;

			if (sameCardPreserved) {
				// Keep the card the user is looking at: no reveal/timer reset.
				set((s) => ({
					review: {
						...s.review,
						queue: [...queue],
						currentIndex: matchedIndex,
						cachedBadgeCounts: countBadges(queue, matchedIndex),
					},
				}));
				return;
			}

			commitQueue(
				promoteActionableCard({ queue: [...queue], currentIndex: 0 }),
			);
		},

		undoLastAnswer: (
			previousIndex: number,
			restoredCard: FSRSFlashcardItem,
			requeuedAtIndex?: number,
		) => {
			const state = get().review;
			if (!state.isActive) return;

			const newQueue = [...state.queue];
			newQueue[previousIndex] = restoredCard;

			if (requeuedAtIndex !== undefined && requeuedAtIndex < newQueue.length) {
				newQueue.splice(requeuedAtIndex, 1);
			}

			set((s) => ({
				review: {
					...s.review,
					results: s.review.results.slice(0, -1),
				},
			}));
			// The restored card goes under the cursor deliberately — undo must
			// show the exact card the user just answered, even if it is a
			// pending learning card, so no promotion here.
			commitQueue({ queue: newQueue, currentIndex: previousIndex });
		},
	};
}
