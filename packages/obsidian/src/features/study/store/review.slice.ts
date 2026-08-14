import { type Grade, Rating, State } from "ts-fsrs";

import type {
	FSRSFlashcardItem,
	ReviewResult,
	ReviewSessionStats,
	SchedulingPreview,
} from "@true-recall/core/types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";

import type {
	AppState,
	AppStoreDeps,
	EditModeState,
	ReviewSliceActions,
	ReviewSliceState,
	SessionPhase,
} from "@true-recall/obsidian/store/types";

import {
	advanceAfterAnswer,
	countBadges,
	insertAt,
	isCardDueNow,
	isPendingLearning,
	promoteActionableCard,
	type QueueSnapshot,
	removeAt,
	removeByIds,
} from "./review-queue.engine";

type ReviewSlice = ReviewSliceState & ReviewSliceActions;

function createDefaultStats(): ReviewSessionStats {
	return {
		total: 0,
		reviewed: 0,
		again: 0,
		hard: 0,
		good: 0,
		easy: 0,
		newCards: 0,
		learningCards: 0,
		reviewCards: 0,
		duration: 0,
	};
}

const INITIAL_EDIT_MODE: EditModeState = {
	active: false,
	field: null,
	originalQuestion: "",
	originalAnswer: "",
};

function createInitialState(): ReviewSliceState {
	return {
		isActive: false,
		queue: [],
		currentIndex: 0,
		isAnswerRevealed: false,
		results: [],
		startTime: 0,
		questionShownTime: 0,
		stats: createDefaultStats(),
		cachedBadgeCounts: { new: 0, learning: 0, due: 0 },
		editMode: { ...INITIAL_EDIT_MODE },
		sessionFilters: {},
	};
}

function buildReviewResult(
	card: FSRSFlashcardItem,
	rating: Grade,
	responseTime: number,
): ReviewResult {
	return {
		cardId: card.id,
		rating,
		timestamp: Date.now(),
		responseTime,
		previousState: card.fsrs.state,
		scheduledDays: card.fsrs.scheduledDays,
		elapsedDays: card.fsrs.lastReview
			? Math.floor(
					(Date.now() - new Date(card.fsrs.lastReview).getTime()) /
						(1000 * 60 * 60 * 24),
				)
			: 0,
	};
}

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

	const initial = createInitialState();

	const slice: ReviewSlice = {
		// State
		...initial,

		startSession: (queue: FSRSFlashcardItem[]) => {
			const promoted = promoteActionableCard({
				queue: [...queue],
				currentIndex: 0,
			});
			schedulingPreview = null;

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
			schedulingPreview = null;
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
			schedulingPreview = null;
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

		getEditState: () => ({ ...get().review.editMode }),

		startEdit: (field: "question" | "answer") => {
			const state = get().review;
			const card = state.queue[state.currentIndex];
			if (!card) return;

			set((s) => ({
				review: {
					...s.review,
					editMode: {
						active: true,
						field,
						originalQuestion: card.question,
						originalAnswer: card.answer,
					},
				},
			}));
		},

		cancelEdit: () => {
			set((s) => ({
				review: {
					...s.review,
					editMode: { ...INITIAL_EDIT_MODE },
				},
			}));
		},

		isEditing: () => get().review.editMode.active,

		updateCurrentCardContent: (question: string, answer: string) => {
			const state = get().review;
			const card = state.queue[state.currentIndex];
			if (!card) return;

			const newQueue = [...state.queue];
			newQueue[state.currentIndex] = {
				...card,
				question,
				answer,
			};

			set((s) => ({
				review: { ...s.review, queue: newQueue },
			}));
		},

		updateCurrentCardComment: (userComment: string | undefined) => {
			const state = get().review;
			const card = state.queue[state.currentIndex];
			if (!card) return;

			const newQueue = [...state.queue];
			newQueue[state.currentIndex] = { ...card, userComment };

			set((s) => ({
				review: { ...s.review, queue: newQueue },
			}));
		},

		getSchedulingPreview: () => schedulingPreview,

		setSchedulingPreview: (preview: SchedulingPreview | null) => {
			schedulingPreview = preview;
		},

		notifyChange: () => {
			set((s) => ({ review: { ...s.review } }));
		},

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

	return slice;
}
