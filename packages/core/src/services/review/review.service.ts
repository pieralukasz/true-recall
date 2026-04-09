import { type Grade, Rating, State } from "ts-fsrs";

import {
	LEARN_AHEAD_LIMIT_MINUTES,
	MS_PER_DAY,
	RANDOM_QUEUE_INSERT_MAX_POS,
} from "../../constants";
import type { FlashcardManager } from "../../flashcard/flashcard.service";
import { isLearningState } from "../../helpers/card-state";
import type {
	CardSchedulingMeta,
	DailyStats,
	ReviewResult,
	ReviewSessionStats,
} from "../../types";
import type {
	FSRSSettings,
	NewCardOrder,
	NewReviewMix,
	ReviewOrder,
} from "../../types/settings.types";
import {
	formatLocalDate,
	getTodayBoundary,
	getTomorrowBoundary,
} from "../../utils";
import type { FSRSService } from "../fsrs/fsrs.service";
import { buildQueue as buildQueueImpl } from "./queue-builder";
import { spaceSiblings as spaceSiblingsImpl } from "./sibling-spacer";

export interface QueueBuildOptions {
	newCardsLimit: number;
	reviewsLimit: number;
	reviewedToday?: Set<string>;
	newCardsStudiedToday?: number;
	/** Review-state cards already completed today (for per-day limit like Anki) */
	reviewsCompletedToday?: number;
	/** Filter to only cards with these source UIDs */
	sourceUidFilter?: Set<string>;
	newCardOrder?: NewCardOrder;
	reviewOrder?: ReviewOrder;
	newReviewMix?: NewReviewMix;

	// Custom session filters
	sourceNoteFilter?: string;
	sourceNoteFilters?: string[];
	filePathFilter?: string;
	createdTodayOnly?: boolean;
	createdThisWeek?: boolean;
	/** stability < WEAK_CARD_STABILITY_THRESHOLD days */
	weakCardsOnly?: boolean;
	stateFilter?: "due" | "learning" | "new" | "buried";
	ignoreDailyLimits?: boolean;
	/** Show all matching cards regardless of due date (like Anki Custom Study) */
	bypassScheduling?: boolean;
	/** 0-23, default 4 like Anki */
	dayStartHour?: number;

	// Advanced custom study filters
	difficultyRange?: { min: number; max: number };
	lapsesRange?: { min: number; max: number };
	stabilityRange?: { min: number; max: number };
	/** Only cards past their due date */
	overdueOnly?: boolean;
	/** Cards whose last review was rated Again */
	recentlyFailed?: boolean;
	/** Overall cap on session size */
	cardLimit?: number;
	/** Include cards due within the next N days (study ahead) */
	studyAheadDays?: number;
	/** Optional per-card preset assignment (global mode) */
	cardPresetById?: Map<string, string>;
	/** Optional daily limits per preset (global mode) */
	presetDailyLimits?: Map<
		string,
		{
			newCardsPerDay: number;
			reviewsPerDay: number;
		}
	>;
	/** Optional progress today per preset (global mode) */
	presetProgressToday?: Map<
		string,
		{
			newStudied: number;
			reviewsCompleted: number;
		}
	>;
	/** Fallback preset name for cards without explicit assignment */
	defaultPresetName?: string;
	/** When false, apply queue spacing instead of runtime sibling burying */
	burySiblings?: boolean;
}

export class ReviewService {
	/**
	 * When burySiblings is off, spread IO/cloze siblings apart in the queue
	 * so cards from the same note don't appear back-to-back.
	 */
	spaceSiblings(queue: CardSchedulingMeta[]): CardSchedulingMeta[] {
		return spaceSiblingsImpl(queue);
	}

	/** Order (Anki-like): Due Learning -> Review -> New -> Pending Learning */
	buildQueue(
		allCards: CardSchedulingMeta[],
		fsrsService: FSRSService,
		options: QueueBuildOptions,
	): CardSchedulingMeta[] {
		return buildQueueImpl(allCards, fsrsService, options);
	}

	processAnswer<T extends CardSchedulingMeta>(
		card: T,
		rating: Grade,
		fsrsService: FSRSService,
		responseTime: number,
		presetSettings?: FSRSSettings,
	): {
		updatedCard: T;
		result: ReviewResult;
	} {
		const now = new Date();
		const previousState = card.fsrs.state;
		const previousScheduledDays = card.fsrs.scheduledDays;

		// Calculate elapsed days since last review
		const elapsedDays = card.fsrs.lastReview
			? Math.max(
					0,
					Math.floor(
						(now.getTime() - new Date(card.fsrs.lastReview).getTime()) /
							MS_PER_DAY,
					),
				)
			: 0;

		const newFsrsData = fsrsService.scheduleCard(
			card.fsrs,
			rating,
			now,
			presetSettings,
		);

		const updatedCard = {
			...card,
			fsrs: newFsrsData,
		} as T;

		const result: ReviewResult = {
			cardId: card.id,
			rating,
			timestamp: now.getTime(),
			responseTime,
			previousState,
			scheduledDays: previousScheduledDays,
			elapsedDays,
		};

		return { updatedCard, result };
	}

	gradeCard<T extends CardSchedulingMeta>(
		card: T,
		rating: Grade,
		fsrsService: FSRSService,
		flashcardManager: FlashcardManager,
		responseTime: number = 0,
	): {
		updatedCard: T;
		result: ReviewResult;
		persisted: boolean;
	} {
		// 1. Calculate new FSRS data
		const { updatedCard, result } = this.processAnswer(
			card,
			rating,
			fsrsService,
			responseTime,
		);

		// 2. Save to store
		let persisted = false;
		if (card.id) {
			persisted = flashcardManager.updateCardFSRS(card.id, updatedCard.fsrs);

			if (persisted) {
				flashcardManager.getEventBus()?.emit("card:reviewed", {
					cardId: card.id,
					rating: rating as number,
					newState: updatedCard.fsrs.state,
				});
			}
		}

		return { updatedCard, result, persisted };
	}

	calculateSessionStats(
		results: ReviewResult[],
		totalCards: number,
		startTime: number,
	): ReviewSessionStats {
		const now = Date.now();

		// Single-pass accumulator - count all stats in one iteration
		const counts = {
			again: 0,
			hard: 0,
			good: 0,
			easy: 0,
			newCards: 0,
			learningCards: 0,
			reviewCards: 0,
		};

		for (const r of results) {
			// Count by rating
			switch (r.rating) {
				case Rating.Again:
					counts.again++;
					break;
				case Rating.Hard:
					counts.hard++;
					break;
				case Rating.Good:
					counts.good++;
					break;
				case Rating.Easy:
					counts.easy++;
					break;
			}

			// Count by previous state
			switch (r.previousState) {
				case State.New:
					counts.newCards++;
					break;
				case State.Learning:
				case State.Relearning:
					counts.learningCards++;
					break;
				case State.Review:
					counts.reviewCards++;
					break;
			}
		}

		return {
			total: totalCards,
			reviewed: results.length,
			...counts,
			duration: now - startTime,
		};
	}

	calculateDailyStats(
		allCards: CardSchedulingMeta[],
		todayResults: ReviewResult[],
		settings: {
			newCardsPerDay: number;
			reviewsPerDay: number;
			dayStartHour?: number;
		},
		dayBoundaryService?: import("./day-boundary.service").DayBoundaryService,
	): DailyStats {
		const now = new Date();
		const dayStartHour = settings.dayStartHour ?? 4;
		const todayBoundary = dayBoundaryService
			? dayBoundaryService.getTodayBoundary(now)
			: getTodayBoundary(dayStartHour, now);
		const tomorrowBoundary = dayBoundaryService
			? dayBoundaryService.getTomorrowBoundary(now)
			: getTomorrowBoundary(dayStartHour, now);

		// Count new cards reviewed today
		const newReviewedToday = todayResults.filter(
			(r) => r.previousState === State.New,
		).length;

		// Count due cards for today using day-based scheduling
		const dueToday = dayBoundaryService
			? dayBoundaryService.countDueCards(allCards, now)
			: allCards.filter((card) => {
					const dueDate = new Date(card.fsrs.due);
					return dueDate < tomorrowBoundary && card.fsrs.state !== State.New;
				}).length;

		// Calculate remaining new cards
		const newRemaining = Math.max(
			0,
			settings.newCardsPerDay - newReviewedToday,
		);

		return {
			newReviewed: newReviewedToday,
			reviewsCompleted: todayResults.length,
			dueToday,
			newRemaining,
			date: formatLocalDate(todayBoundary),
		};
	}

	/**
	 * Check if a card should be re-added to queue (for learning cards)
	 * Learning/Relearning cards are ALWAYS requeued - the position is determined
	 * by getRequeuePosition(). Cards due soon go near the front, cards due later
	 * go at the end where getPhase() will trigger the waiting screen.
	 */
	shouldRequeue(card: CardSchedulingMeta): boolean {
		return isLearningState(card.fsrs.state);
	}

	getRequeuePosition(
		queue: CardSchedulingMeta[],
		startIndex: number,
		card: CardSchedulingMeta,
		reviewOrder?: ReviewOrder,
	): number {
		const dueDate = new Date(card.fsrs.due);
		const now = new Date();

		// For random sort: insert learning cards near front with some randomness
		// Using due-date ordering in a shuffled queue would place cards incorrectly
		if (reviewOrder === "random") {
			const learnAheadTime = new Date(
				now.getTime() + LEARN_AHEAD_LIMIT_MINUTES * 60 * 1000,
			);
			if (dueDate <= learnAheadTime) {
				// Card is due soon - insert randomly in first positions after startIndex
				const remaining = queue.length - startIndex;
				const maxPos = Math.min(RANDOM_QUEUE_INSERT_MAX_POS, remaining);
				return startIndex + Math.floor(Math.random() * (maxPos + 1));
			}
			// Card not due yet - append to end
			return queue.length;
		}

		// For due-date or due-date-random: binary search within remaining queue
		const dueTime = dueDate.getTime();
		let low = startIndex;
		let high = queue.length;

		while (low < high) {
			const mid = (low + high) >>> 1;
			const midCard = queue[mid];
			if (!midCard) {
				low = mid + 1;
				continue;
			}
			const midDue = new Date(midCard.fsrs.due).getTime();
			if (midDue < dueTime) {
				low = mid + 1;
			} else {
				high = mid;
			}
		}
		return low;
	}

	calculateRetentionRate(results: ReviewResult[]): number {
		if (results.length === 0) return 0;
		const successes = results.filter(
			(r) => r.rating === Rating.Good || r.rating === Rating.Easy,
		).length;
		return successes / results.length;
	}

	getStreakInfo(
		results: ReviewResult[],
		dayStartHour: number = 4,
	): {
		currentStreak: number;
		longestStreak: number;
	} {
		if (results.length === 0) return { currentStreak: 0, longestStreak: 0 };

		// Group reviews by FSRS day (adjusted by dayStartHour)
		const uniqueDays = new Set(
			results.map((r) => {
				const d = new Date(r.timestamp);
				// Shift by dayStartHour so e.g. 3 AM maps to "yesterday"
				d.setHours(d.getHours() - dayStartHour);
				return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
			}),
		);
		const sortedDays = [...uniqueDays]
			.map((key) => {
				const [y = 0, m = 0, d = 1] = key.split("-").map(Number);
				const date = new Date(y, m, d);
				date.setHours(0, 0, 0, 0);
				return date.getTime();
			})
			.sort((a, b) => b - a);

		const DAY_MS = MS_PER_DAY;
		let longestStreak = 1;
		let currentStreak = 1;

		// Walk sorted days (newest first), count consecutive
		for (let i = 1; i < sortedDays.length; i++) {
			const prev = sortedDays[i - 1];
			const curr = sortedDays[i];
			if (prev !== undefined && curr !== undefined && prev - curr === DAY_MS) {
				currentStreak++;
			} else {
				if (currentStreak > longestStreak) longestStreak = currentStreak;
				currentStreak = 1;
			}
		}
		if (currentStreak > longestStreak) longestStreak = currentStreak;

		// Current streak: count consecutive days ending at today or yesterday
		const now = new Date();
		now.setHours(now.getHours() - dayStartHour);
		now.setHours(0, 0, 0, 0);
		const todayMs = now.getTime();
		const yesterdayMs = todayMs - DAY_MS;

		const newest = sortedDays[0];
		if (newest !== todayMs && newest !== yesterdayMs) {
			return { currentStreak: 0, longestStreak };
		}

		let streak = 1;
		for (let i = 1; i < sortedDays.length; i++) {
			const prev = sortedDays[i - 1];
			const curr = sortedDays[i];
			if (prev !== undefined && curr !== undefined && prev - curr === DAY_MS) {
				streak++;
			} else {
				break;
			}
		}

		return { currentStreak: streak, longestStreak };
	}
}
