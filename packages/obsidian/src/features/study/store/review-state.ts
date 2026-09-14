import type { Grade } from "ts-fsrs";

import type {
	FSRSFlashcardItem,
	ReviewResult,
	ReviewSessionStats,
} from "@true-recall/core/types";

import type {
	EditModeState,
	ReviewSliceState,
} from "@true-recall/obsidian/store/types";

export function createDefaultStats(): ReviewSessionStats {
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

export const INITIAL_EDIT_MODE: EditModeState = {
	active: false,
	field: null,
	originalQuestion: "",
	originalAnswer: "",
};

export function createInitialState(): ReviewSliceState {
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

export function buildReviewResult(
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
