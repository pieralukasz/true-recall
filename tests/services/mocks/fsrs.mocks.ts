/**
 * Shared mock factories for FSRS and Review tests
 */
import { State, Rating, type Grade } from "ts-fsrs";
import type {
	FSRSCardData,
	FSRSFlashcardItem,
	ReviewResult,
	ReviewSessionState,
	SourceNoteInfo,
} from "../../../src/types/fsrs.types";
import type { FSRSSettings } from "../../../src/types/settings.types";

/**
 * Create a mock FSRSCardData with sensible defaults
 */
export function createMockCard(
	overrides: Partial<FSRSCardData> = {}
): FSRSCardData {
	const now = new Date();
	return {
		id: overrides.id ?? `card-${Math.random().toString(36).slice(2, 10)}`,
		due: overrides.due ?? now.toISOString(),
		stability: overrides.stability ?? 0,
		difficulty: overrides.difficulty ?? 0,
		reps: overrides.reps ?? 0,
		lapses: overrides.lapses ?? 0,
		state: overrides.state ?? State.New,
		lastReview: overrides.lastReview ?? null,
		scheduledDays: overrides.scheduledDays ?? 0,
		learningStep: overrides.learningStep ?? 0,
		suspended: overrides.suspended ?? false,
		buriedUntil: overrides.buriedUntil,
		createdAt: overrides.createdAt ?? Date.now(),
		question: overrides.question,
		answer: overrides.answer,
		sourceUid: overrides.sourceUid,
		tags: overrides.tags,
	};
}

/**
 * Create a new card (state: New, never reviewed)
 */
export function createNewCard(id?: string): FSRSCardData {
	return createMockCard({
		id: id ?? "new-card-1",
		state: State.New,
		reps: 0,
		lastReview: null,
	});
}

/**
 * Create a learning card (in learning phase)
 */
export function createLearningCard(
	id?: string,
	learningStep = 0
): FSRSCardData {
	const now = new Date();
	return createMockCard({
		id: id ?? "learning-card-1",
		state: State.Learning,
		reps: 1,
		learningStep,
		lastReview: now.toISOString(),
		stability: 0.4,
		difficulty: 5,
	});
}

/**
 * Create a review card (graduated, in review phase)
 */
export function createReviewCard(
	id?: string,
	daysOverdue = 0
): FSRSCardData {
	const now = new Date();
	const due = new Date(now);
	due.setDate(due.getDate() - daysOverdue);

	return createMockCard({
		id: id ?? "review-card-1",
		state: State.Review,
		reps: 5,
		lapses: 0,
		lastReview: new Date(
			now.getTime() - 7 * 24 * 60 * 60 * 1000
		).toISOString(),
		due: due.toISOString(),
		stability: 7,
		difficulty: 5,
		scheduledDays: 7,
	});
}

/**
 * Create a relearning card (lapsed, back to learning)
 */
export function createRelearningCard(id?: string): FSRSCardData {
	const now = new Date();
	return createMockCard({
		id: id ?? "relearning-card-1",
		state: State.Relearning,
		reps: 10,
		lapses: 2,
		learningStep: 0,
		lastReview: now.toISOString(),
		stability: 0.5,
		difficulty: 7,
	});
}

/**
 * Create a mock FSRSFlashcardItem (UI flashcard with full data)
 */
export function createMockFlashcard(
	overrides: Partial<FSRSFlashcardItem> = {}
): FSRSFlashcardItem {
	const cardData = createMockCard(overrides.fsrs);
	return {
		id: overrides.id ?? cardData.id,
		question: overrides.question ?? "What is the capital of France?",
		answer: overrides.answer ?? "Paris",
		filePath: overrides.filePath ?? "",
		fsrs: cardData,
		projects: overrides.projects ?? ["Geography"],
		sourceNoteName: overrides.sourceNoteName,
		sourceUid: overrides.sourceUid,
	};
}

/**
 * Create default FSRS settings
 */
export function createDefaultFSRSSettings(): FSRSSettings {
	return {
		requestRetention: 0.9,
		maximumInterval: 36500,
		weights: undefined, // Use defaults from ts-fsrs
		enableShortTerm: true,
		learningSteps: [1, 10],
		relearningSteps: [10],
		newCardsPerDay: 20,
		reviewsPerDay: 200,
		learningCardsPerSession: 50,
	};
}

/**
 * Create a mock ReviewResult
 */
export function createMockReviewResult(
	overrides: Partial<ReviewResult> = {}
): ReviewResult {
	return {
		cardId: overrides.cardId ?? "card-1",
		rating: overrides.rating ?? (Rating.Good as Grade),
		timestamp: overrides.timestamp ?? Date.now(),
		responseTime: overrides.responseTime ?? 3000,
		previousState: overrides.previousState ?? State.New,
		scheduledDays: overrides.scheduledDays ?? 0,
		elapsedDays: overrides.elapsedDays ?? 0,
	};
}

/**
 * Create a mock review session state
 */
export function createMockSessionState(
	overrides: Partial<ReviewSessionState> = {}
): ReviewSessionState {
	return {
		isActive: overrides.isActive ?? false,
		queue: overrides.queue ?? [],
		currentIndex: overrides.currentIndex ?? 0,
		isAnswerRevealed: overrides.isAnswerRevealed ?? false,
		results: overrides.results ?? [],
		startTime: overrides.startTime ?? 0,
		questionShownTime: overrides.questionShownTime ?? 0,
		stats: overrides.stats ?? {
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
		},
	};
}

/**
 * Create an array of mixed cards for queue testing
 */
export function createMixedCardQueue(): FSRSFlashcardItem[] {
	const pastDue = new Date();
	pastDue.setDate(pastDue.getDate() - 1);

	return [
		createMockFlashcard({
			id: "new-1",
			question: "New card 1",
			fsrs: { state: State.New },
		}),
		createMockFlashcard({
			id: "new-2",
			question: "New card 2",
			fsrs: { state: State.New },
		}),
		createMockFlashcard({
			id: "learning-1",
			question: "Learning card 1",
			fsrs: {
				state: State.Learning,
				due: new Date().toISOString(),
				learningStep: 0,
			},
		}),
		createMockFlashcard({
			id: "review-1",
			question: "Review card (due)",
			fsrs: {
				state: State.Review,
				due: pastDue.toISOString(),
				scheduledDays: 7,
			},
		}),
		createMockFlashcard({
			id: "review-2",
			question: "Review card (not due)",
			fsrs: {
				state: State.Review,
				due: new Date(Date.now() + 86400000).toISOString(),
				scheduledDays: 14,
			},
		}),
	];
}

/**
 * Create a mock SourceNoteInfo with sensible defaults
 */
export function createMockSourceNote(
	overrides: Partial<SourceNoteInfo> = {}
): SourceNoteInfo {
	const now = Date.now();
	return {
		uid: overrides.uid ?? `src-${Math.random().toString(36).slice(2, 10)}`,
		noteName: overrides.noteName ?? "Test Note",
		notePath: overrides.notePath ?? "notes/test-note.md",
		projects: overrides.projects,
		createdAt: overrides.createdAt ?? now,
		updatedAt: overrides.updatedAt ?? now,
	};
}

/**
 * Create a mock flashcard with source note path (SQL-only card)
 */
export function createMockFlashcardWithSourcePath(
	overrides: Partial<FSRSFlashcardItem> = {}
): FSRSFlashcardItem {
	const cardData = createMockCard(overrides.fsrs);
	return {
		id: overrides.id ?? cardData.id,
		question: overrides.question ?? "What is machine learning?",
		answer: overrides.answer ?? "A type of AI that learns from data",
		filePath: overrides.filePath ?? "", // Empty for SQL-only cards
		fsrs: cardData,
		projects: overrides.projects ?? ["AI/ML"],
		sourceNoteName: overrides.sourceNoteName ?? "Machine Learning Basics",
		sourceUid: overrides.sourceUid ?? "abc12345",
		sourceNotePath: overrides.sourceNotePath ?? "input/machine-learning.md",
	};
}
