import { type Grade, Rating, State } from "ts-fsrs";
import { LEARN_AHEAD_LIMIT_MINUTES } from "../../../shared/constants";
import type {
	FSRSFlashcardItem,
	ReviewResult,
	ReviewSessionStats,
	SchedulingPreview,
} from "../../../shared/types";
import type {
	AppState,
	AppStoreDeps,
	BadgeCounts,
	EditModeState,
	ReviewSliceActions,
	ReviewSliceState,
	SessionPhase,
} from "../../../shared/store/types";

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
	};
}

function getBadgeTypeForState(cardState: State): keyof BadgeCounts {
	if (cardState === State.New) return "new";
	if (cardState === State.Learning || cardState === State.Relearning)
		return "learning";
	return "due";
}

function computeBadgeCounts(
	queue: FSRSFlashcardItem[],
	startIndex: number,
): BadgeCounts {
	const counts: BadgeCounts = { new: 0, learning: 0, due: 0 };
	for (let i = startIndex; i < queue.length; i++) {
		const card = queue[i];
		if (card) {
			const badgeType = getBadgeTypeForState(card.fsrs.state);
			counts[badgeType]++;
		}
	}
	return counts;
}

export function createReviewSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	_deps: AppStoreDeps,
): ReviewSlice {
	// Edit mode stored outside state to avoid triggering subscriptions
	let editMode: EditModeState = {
		active: false,
		field: null,
		originalQuestion: "",
		originalAnswer: "",
	};

	// Scheduling preview (ephemeral)
	let schedulingPreview: SchedulingPreview | null = null;

	// Helper to check if card is due
	const isCardDueNowInternal = (card: FSRSFlashcardItem): boolean => {
		const dueDate = new Date(card.fsrs.due);
		const now = new Date();

		const isLearning =
			card.fsrs.state === State.Learning ||
			card.fsrs.state === State.Relearning;
		if (isLearning) {
			return dueDate <= now;
		}

		const learnAheadTime = new Date(
			now.getTime() + LEARN_AHEAD_LIMIT_MINUTES * 60 * 1000,
		);
		return dueDate <= learnAheadTime;
	};

	const initial = createInitialState();

	const slice: ReviewSlice = {
		// State
		isActive: initial.isActive,
		queue: initial.queue,
		currentIndex: initial.currentIndex,
		isAnswerRevealed: initial.isAnswerRevealed,
		results: initial.results,
		startTime: initial.startTime,
		questionShownTime: initial.questionShownTime,
		stats: initial.stats,
		cachedBadgeCounts: initial.cachedBadgeCounts,

		startSession: (queue: FSRSFlashcardItem[]) => {
			const cachedBadgeCounts = computeBadgeCounts(queue, 0);
			schedulingPreview = null;

			set((s) => ({
				review: {
					...s.review,
					isActive: true,
					queue: [...queue],
					currentIndex: 0,
					isAnswerRevealed: false,
					results: [],
					startTime: Date.now(),
					questionShownTime: Date.now(),
					stats: {
						total: queue.length,
						reviewed: 0,
						again: 0,
						hard: 0,
						good: 0,
						easy: 0,
						newCards: 0,
						learningCards: 0,
						reviewCards: 0,
						duration: 0,
					},
					cachedBadgeCounts,
				},
			}));
		},

		endSession: () => {
			schedulingPreview = null;
			set((s) => ({
				review: {
					...s.review,
					isActive: false,
					stats: {
						...s.review.stats,
						duration: Date.now() - s.review.startTime,
					},
				},
			}));
		},

		reset: () => {
			schedulingPreview = null;
			editMode = {
				active: false,
				field: null,
				originalQuestion: "",
				originalAnswer: "",
			};
			const initialState = createInitialState();
			set((s) => ({
				review: {
					...s.review,
					isActive: initialState.isActive,
					queue: initialState.queue,
					currentIndex: initialState.currentIndex,
					isAnswerRevealed: initialState.isAnswerRevealed,
					results: initialState.results,
					startTime: initialState.startTime,
					questionShownTime: initialState.questionShownTime,
					stats: initialState.stats,
					cachedBadgeCounts: initialState.cachedBadgeCounts,
				},
			}));
		},

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

			// Update badge counts incrementally - O(1)
			const currentCard = state.queue[state.currentIndex];
			const newCounts = { ...state.cachedBadgeCounts };
			if (currentCard) {
				const badgeType = getBadgeTypeForState(currentCard.fsrs.state);
				newCounts[badgeType]--;
			}

			const nextIndex = state.currentIndex + 1;
			schedulingPreview = null;

			set((s) => ({
				review: {
					...s.review,
					currentIndex: nextIndex,
					isAnswerRevealed: false,
					questionShownTime: Date.now(),
					cachedBadgeCounts: newCounts,
				},
			}));

			return nextIndex < state.queue.length;
		},

		recordAnswer: (rating: Grade, updatedCard: FSRSFlashcardItem) => {
			const state = get().review;
			if (!state.isActive) return false;

			const currentCard = state.queue[state.currentIndex];
			if (!currentCard) return false;

			const responseTime = Date.now() - state.questionShownTime;
			const result: ReviewResult = {
				cardId: currentCard.id,
				rating,
				timestamp: Date.now(),
				responseTime,
				previousState: currentCard.fsrs.state,
				scheduledDays: currentCard.fsrs.scheduledDays,
				elapsedDays: currentCard.fsrs.lastReview
					? Math.floor(
							(Date.now() - new Date(currentCard.fsrs.lastReview).getTime()) /
								(1000 * 60 * 60 * 24),
						)
					: 0,
			};

			const newQueue = [...state.queue];
			newQueue[state.currentIndex] = updatedCard;

			set((s) => ({
				review: {
					...s.review,
					queue: newQueue,
					results: [...s.review.results, result],
				},
			}));

			return true;
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

			// Update badge counts incrementally - O(1)
			const newBadgeCounts = { ...state.cachedBadgeCounts };
			const oldBadgeType = getBadgeTypeForState(currentCard.fsrs.state);
			newBadgeCounts[oldBadgeType]--;

			if (requeueData) {
				const newBadgeType = getBadgeTypeForState(requeueData.card.fsrs.state);
				newBadgeCounts[newBadgeType]++;
			}

			// Record answer
			const responseTime = Date.now() - state.questionShownTime;
			const result: ReviewResult = {
				cardId: currentCard.id,
				rating,
				timestamp: Date.now(),
				responseTime,
				previousState: currentCard.fsrs.state,
				scheduledDays: currentCard.fsrs.scheduledDays,
				elapsedDays: currentCard.fsrs.lastReview
					? Math.floor(
							(Date.now() - new Date(currentCard.fsrs.lastReview).getTime()) /
								(1000 * 60 * 60 * 24),
						)
					: 0,
			};

			const newQueue = [...state.queue];
			newQueue[state.currentIndex] = updatedCard;

			if (requeueData) {
				newQueue.splice(requeueData.position, 0, requeueData.card);
			}

			const nextIndex = state.currentIndex + 1;

			// If the next card is a pending learning card, swap it with
			// the first actionable card further in the queue so due cards
			// are shown before the waiting screen.
			if (nextIndex < newQueue.length) {
				const nextCard = newQueue[nextIndex];
				if (nextCard) {
					const nextIsLearning =
						nextCard.fsrs.state === State.Learning ||
						nextCard.fsrs.state === State.Relearning;
					if (nextIsLearning && !isCardDueNowInternal(nextCard)) {
						for (let i = nextIndex + 1; i < newQueue.length; i++) {
							const candidate = newQueue[i];
							if (!candidate) continue;
							const candidateIsLearning =
								candidate.fsrs.state === State.Learning ||
								candidate.fsrs.state === State.Relearning;
							if (!candidateIsLearning || isCardDueNowInternal(candidate)) {
								const a = newQueue[nextIndex];
								const b = newQueue[i];
								if (a && b) {
									newQueue[nextIndex] = b;
									newQueue[i] = a;
								}
								if (requeueData) {
									if (requeueData.position === nextIndex) {
										requeueData.position = i;
									} else if (requeueData.position === i) {
										requeueData.position = nextIndex;
									}
								}
								break;
							}
						}
					}
				}
			}

			schedulingPreview = null;

			set((s) => ({
				review: {
					...s.review,
					queue: newQueue,
					results: [...s.review.results, result],
					currentIndex: nextIndex,
					isAnswerRevealed: false,
					questionShownTime: Date.now(),
					cachedBadgeCounts: newBadgeCounts,
				},
			}));

			return nextIndex < newQueue.length;
		},

		requeueCard: (card: FSRSFlashcardItem, position?: number) => {
			const state = get().review;
			const newQueue = [...state.queue];

			const insertPosition =
				position !== undefined ? position : newQueue.length;
			if (position !== undefined) {
				newQueue.splice(position, 0, card);
			} else {
				newQueue.push(card);
			}

			// Update badge counts if inserted in remaining queue
			const newCounts = { ...state.cachedBadgeCounts };
			if (insertPosition >= state.currentIndex) {
				const badgeType = getBadgeTypeForState(card.fsrs.state);
				newCounts[badgeType]++;
			}

			set((s) => ({
				review: {
					...s.review,
					queue: newQueue,
					cachedBadgeCounts: newCounts,
				},
			}));
		},

		removeCurrentCard: () => {
			const state = get().review;
			if (!state.isActive) return;

			const currentCard = state.queue[state.currentIndex];
			const newCounts = { ...state.cachedBadgeCounts };
			if (currentCard) {
				const badgeType = getBadgeTypeForState(currentCard.fsrs.state);
				newCounts[badgeType]--;
			}

			const newQueue = [...state.queue];
			newQueue.splice(state.currentIndex, 1);
			schedulingPreview = null;

			set((s) => ({
				review: {
					...s.review,
					queue: newQueue,
					isAnswerRevealed: false,
					questionShownTime: Date.now(),
					cachedBadgeCounts: newCounts,
				},
			}));
		},

		removeCardById: (cardId: string) => {
			const state = get().review;
			if (!state.isActive) return;

			const cardIndex = state.queue.findIndex((c) => c.id === cardId);
			if (cardIndex === -1) return;

			// Update badge counts if in remaining queue
			const newCounts = { ...state.cachedBadgeCounts };
			if (cardIndex >= state.currentIndex) {
				const card = state.queue[cardIndex];
				if (card) {
					const badgeType = getBadgeTypeForState(card.fsrs.state);
					newCounts[badgeType]--;
				}
			}

			const newQueue = [...state.queue];
			newQueue.splice(cardIndex, 1);

			// Adjust currentIndex if needed
			let newIndex = state.currentIndex;
			if (cardIndex < state.currentIndex) {
				newIndex = Math.max(0, newIndex - 1);
			} else if (
				cardIndex === state.currentIndex &&
				newIndex >= newQueue.length
			) {
				newIndex = Math.max(0, newQueue.length - 1);
			}

			schedulingPreview = null;

			set((s) => ({
				review: {
					...s.review,
					queue: newQueue,
					currentIndex: newIndex,
					isAnswerRevealed: false,
					questionShownTime: Date.now(),
					cachedBadgeCounts: newCounts,
				},
			}));
		},

		removeCardsByIds: (cardIds: string[]) => {
			const state = get().review;
			if (!state.isActive || cardIds.length === 0) return;

			const idsToRemove = new Set(cardIds);
			let newIndex = state.currentIndex;
			let removedBeforeCurrent = 0;

			for (let i = 0; i < state.currentIndex; i++) {
				const card = state.queue[i];
				if (card && idsToRemove.has(card.id)) {
					removedBeforeCurrent++;
				}
			}

			// Update badge counts for cards in remaining queue
			const newCounts = { ...state.cachedBadgeCounts };
			for (let i = state.currentIndex; i < state.queue.length; i++) {
				const card = state.queue[i];
				if (card && idsToRemove.has(card.id)) {
					const badgeType = getBadgeTypeForState(card.fsrs.state);
					newCounts[badgeType]--;
				}
			}

			const newQueue = state.queue.filter((c) => !idsToRemove.has(c.id));

			newIndex = Math.max(0, newIndex - removedBeforeCurrent);
			if (newIndex >= newQueue.length && newQueue.length > 0) {
				newIndex = newQueue.length - 1;
			}

			schedulingPreview = null;

			set((s) => ({
				review: {
					...s.review,
					queue: newQueue,
					currentIndex: newIndex,
					isAnswerRevealed: false,
					questionShownTime: Date.now(),
					cachedBadgeCounts: newCounts,
				},
			}));
		},

		addCardToQueue: (card: FSRSFlashcardItem) => {
			const state = get().review;
			if (!state.isActive) return;
			if (state.queue.some((c) => c.id === card.id)) return;

			const badgeType = getBadgeTypeForState(card.fsrs.state);
			const newCounts = { ...state.cachedBadgeCounts };
			newCounts[badgeType]++;

			set((s) => ({
				review: {
					...s.review,
					queue: [...s.review.queue, card],
					cachedBadgeCounts: newCounts,
				},
			}));
		},

		insertCardAtPosition: (card: FSRSFlashcardItem, position: number) => {
			const state = get().review;
			if (!state.isActive) return;

			const clampedPosition = Math.max(
				0,
				Math.min(position, state.queue.length),
			);

			const newCounts = { ...state.cachedBadgeCounts };
			if (clampedPosition >= state.currentIndex) {
				const badgeType = getBadgeTypeForState(card.fsrs.state);
				newCounts[badgeType]++;
			}

			const newQueue = [...state.queue];
			newQueue.splice(clampedPosition, 0, card);
			schedulingPreview = null;

			set((s) => ({
				review: {
					...s.review,
					queue: newQueue,
					isAnswerRevealed: false,
					questionShownTime: Date.now(),
					cachedBadgeCounts: newCounts,
				},
			}));
		},

		undoLastAnswer: (
			previousIndex: number,
			restoredCard: FSRSFlashcardItem,
			requeuedAtIndex?: number,
		) => {
			const state = get().review;
			if (!state.isActive) return;

			const newCounts = { ...state.cachedBadgeCounts };
			const restoredBadgeType = getBadgeTypeForState(restoredCard.fsrs.state);
			newCounts[restoredBadgeType]++;

			if (
				requeuedAtIndex !== undefined &&
				requeuedAtIndex < state.queue.length
			) {
				const requeuedCard = state.queue[requeuedAtIndex];
				if (requeuedCard) {
					const requeuedBadgeType = getBadgeTypeForState(
						requeuedCard.fsrs.state,
					);
					newCounts[requeuedBadgeType]--;
				}
			}

			const newQueue = [...state.queue];
			newQueue[previousIndex] = restoredCard;

			if (requeuedAtIndex !== undefined && requeuedAtIndex < newQueue.length) {
				newQueue.splice(requeuedAtIndex, 1);
			}

			const newResults = state.results.slice(0, -1);
			schedulingPreview = null;

			set((s) => ({
				review: {
					...s.review,
					queue: newQueue,
					currentIndex: previousIndex,
					isAnswerRevealed: false,
					questionShownTime: Date.now(),
					results: newResults,
					cachedBadgeCounts: newCounts,
				},
			}));
		},

		getEditState: () => ({ ...editMode }),

		startEdit: (field: "question" | "answer") => {
			const card = get().review.queue[get().review.currentIndex];
			if (!card) return;

			editMode = {
				active: true,
				field,
				originalQuestion: card.question,
				originalAnswer: card.answer,
			};
		},

		cancelEdit: () => {
			editMode = {
				active: false,
				field: null,
				originalQuestion: "",
				originalAnswer: "",
			};
		},

		isEditing: () => editMode.active,

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

		getSchedulingPreview: () => schedulingPreview,

		setSchedulingPreview: (preview: SchedulingPreview | null) => {
			schedulingPreview = preview;
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
				if (state.stats.reviewed > 0) {
					return { type: "complete", stats: get().review.getStats() };
				}
				return { type: "idle" };
			}

			if (state.currentIndex >= state.queue.length) {
				return { type: "complete", stats: get().review.getStats() };
			}

			const currentCard = state.queue[state.currentIndex];
			if (currentCard) {
				const isLearning =
					currentCard.fsrs.state === State.Learning ||
					currentCard.fsrs.state === State.Relearning;
				if (isLearning && !isCardDueNowInternal(currentCard)) {
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

		isCardDueNow: isCardDueNowInternal,

		getPendingLearningCards: () => {
			const state = get().review;
			const remaining = state.queue.slice(state.currentIndex);
			return remaining.filter((card) => {
				const isLearning =
					card.fsrs.state === State.Learning ||
					card.fsrs.state === State.Relearning;
				return isLearning && !isCardDueNowInternal(card);
			});
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

			const isLearning =
				currentCard.fsrs.state === State.Learning ||
				currentCard.fsrs.state === State.Relearning;
			if (!isLearning) return false;

			if (isCardDueNowInternal(currentCard)) return false;

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
