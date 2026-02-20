import type { DayBoundaryService } from "@features/core/services/day-boundary.service";
import type { FSRSService } from "@features/core/services/fsrs.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import {
	LEARN_AHEAD_LIMIT_MINUTES,
	RANDOM_QUEUE_INSERT_MAX_POS,
	WEAK_CARD_STABILITY_THRESHOLD,
} from "@shared/constants";
import { notifyCardChange } from "@shared/services/signals";
import type {
	DailyStats,
	FSRSFlashcardItem,
	ReviewResult,
	ReviewSessionStats,
} from "@shared/types";
import type {
	NewCardOrder,
	NewReviewMix,
	ReviewOrder,
} from "@shared/types/settings.types";
import { getTodayBoundary, stripWikiLinkSyntax } from "@shared/utils";
import { type Grade, Rating, State } from "ts-fsrs";

export interface QueueBuildOptions {
	newCardsLimit: number;
	reviewsLimit: number;
	reviewedToday?: Set<string>;
	newCardsStudiedToday?: number;
	/** Review-state cards already completed today (for per-day limit like Anki) */
	reviewsCompletedToday?: number;
	/** Card matches if it has ANY of these projects */
	projectFilters?: string[];
	/** Fallback for project resolution when card.projects is empty */
	sourceUidToProjects?: Map<string, string[]>;
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
}

export class ReviewService {
	private shuffle<T>(array: T[]): T[] {
		const result = [...array];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const temp = result[i] as T;
			result[i] = result[j] as T;
			result[j] = temp;
		}
		return result;
	}

	private interleave<T>(primary: T[], secondary: T[]): T[] {
		if (secondary.length === 0) return [...primary];
		if (primary.length === 0) return [...secondary];

		const result: T[] = [];
		const ratio = primary.length / secondary.length;
		let primaryIndex = 0;
		let secondaryIndex = 0;

		while (primaryIndex < primary.length || secondaryIndex < secondary.length) {
			const targetPrimary = Math.floor((secondaryIndex + 1) * ratio);
			while (primaryIndex < targetPrimary && primaryIndex < primary.length) {
				const item = primary[primaryIndex];
				if (item !== undefined) result.push(item);
				primaryIndex++;
			}
			if (secondaryIndex < secondary.length) {
				const item = secondary[secondaryIndex];
				if (item !== undefined) result.push(item);
				secondaryIndex++;
			}
		}
		while (primaryIndex < primary.length) {
			const item = primary[primaryIndex];
			if (item !== undefined) result.push(item);
			primaryIndex++;
		}

		return result;
	}

	private sortByCreatedAt(cards: FSRSFlashcardItem[]): FSRSFlashcardItem[] {
		return [...cards].sort((a, b) => {
			const aTime = a.fsrs.createdAt ?? 0;
			const bTime = b.fsrs.createdAt ?? 0;
			if (aTime !== bTime) return aTime - bTime;
			// Fallback to ID for deterministic order
			return a.id.localeCompare(b.id);
		});
	}

	private sortByCreatedAtDesc(cards: FSRSFlashcardItem[]): FSRSFlashcardItem[] {
		return [...cards].sort((a, b) => {
			const aTime = a.fsrs.createdAt ?? 0;
			const bTime = b.fsrs.createdAt ?? 0;
			if (aTime !== bTime) return bTime - aTime;
			return b.id.localeCompare(a.id);
		});
	}

	private calculateBoundaries(dayStartHour: number = 4): {
		now: Date;
		todayBoundary: Date;
		weekAgoBoundary: Date;
	} {
		const now = new Date();
		const todayBoundary = getTodayBoundary(dayStartHour, now);

		const weekAgoBoundary = new Date(todayBoundary);
		weekAgoBoundary.setDate(weekAgoBoundary.getDate() - 7);

		return { now, todayBoundary, weekAgoBoundary };
	}

	private filterCards(
		cards: FSRSFlashcardItem[],
		options: QueueBuildOptions,
		todayBoundary: Date,
		weekAgoBoundary: Date,
	): FSRSFlashcardItem[] {
		const noteSet = options.sourceNoteFilters?.length
			? new Set(options.sourceNoteFilters)
			: null;
		const projectSet = options.projectFilters?.length
			? new Set(options.projectFilters)
			: null;

		return cards.filter((card) => {
			// Source note filter
			if (noteSet) {
				if (!card.sourceNoteName || !noteSet.has(card.sourceNoteName))
					return false;
			} else if (options.sourceNoteFilter) {
				if (card.sourceNoteName !== options.sourceNoteFilter) return false;
			}

			// File path filter (uses sourceNotePath)
			if (
				options.filePathFilter &&
				card.sourceNotePath !== options.filePathFilter
			) {
				return false;
			}

			// Created today filter
			if (options.createdTodayOnly) {
				const createdAt = card.fsrs.createdAt;
				if (!createdAt || createdAt < todayBoundary.getTime()) return false;
			}

			// Created this week filter
			if (options.createdThisWeek) {
				const createdAt = card.fsrs.createdAt;
				if (!createdAt || createdAt < weekAgoBoundary.getTime()) return false;
			}

			// Weak cards filter
			if (
				options.weakCardsOnly &&
				card.fsrs.stability >= WEAK_CARD_STABILITY_THRESHOLD
			) {
				return false;
			}

			// State filter
			if (options.stateFilter) {
				switch (options.stateFilter) {
					case "new":
						if (card.fsrs.state !== State.New) return false;
						break;
					case "learning":
						if (
							card.fsrs.state !== State.Learning &&
							card.fsrs.state !== State.Relearning
						)
							return false;
						break;
					case "due":
						if (card.fsrs.state !== State.Review) return false;
						break;
					case "buried": {
						// Card is buried if buriedUntil is set and hasn't passed
						const buriedUntil = card.fsrs.buriedUntil;
						if (!buriedUntil || new Date(buriedUntil).getTime() <= Date.now())
							return false;
						break;
					}
				}
			}

			// Difficulty range filter
			if (options.difficultyRange) {
				if (
					card.fsrs.difficulty < options.difficultyRange.min ||
					card.fsrs.difficulty > options.difficultyRange.max
				)
					return false;
			}

			// Lapses range filter
			if (options.lapsesRange) {
				if (
					card.fsrs.lapses < options.lapsesRange.min ||
					card.fsrs.lapses > options.lapsesRange.max
				)
					return false;
			}

			// Stability range filter
			if (options.stabilityRange) {
				if (
					card.fsrs.stability < options.stabilityRange.min ||
					card.fsrs.stability > options.stabilityRange.max
				)
					return false;
			}

			// Overdue only: exclude new cards and cards not yet due
			if (options.overdueOnly) {
				if (card.fsrs.state === State.New) return false;
				if (new Date(card.fsrs.due) > new Date()) return false;
			}

			// Recently failed: last review was Again
			if (options.recentlyFailed) {
				const history = card.fsrs.history;
				if (!history || history.length === 0) return false;
				if (history[history.length - 1]?.r !== Rating.Again) return false;
			}

			// Study ahead: include cards due within the next N days
			if (options.studyAheadDays !== undefined && options.studyAheadDays > 0) {
				if (card.fsrs.state === State.Review) {
					const cutoff = new Date(
						Date.now() + options.studyAheadDays * 86_400_000,
					);
					if (new Date(card.fsrs.due) > cutoff) return false;
				}
			}

			// Project filter - use sourceUidToProjects map as fallback
			if (projectSet) {
				let cardProjects = card.projects;

				// Fallback: if card.projects empty but has sourceUid, resolve from map
				if (
					cardProjects.length === 0 &&
					card.sourceUid &&
					options.sourceUidToProjects
				) {
					cardProjects = options.sourceUidToProjects.get(card.sourceUid) || [];
				}

				const matches = cardProjects.some((p) =>
					projectSet.has(stripWikiLinkSyntax(p)),
				);
				if (!matches) {
					return false;
				}
			}

			return true;
		});
	}

	private sortNewCards(
		cards: FSRSFlashcardItem[],
		order: NewCardOrder,
	): FSRSFlashcardItem[] {
		switch (order) {
			case "random":
				return this.shuffle(cards);
			case "oldest-first":
				return this.sortByCreatedAt(cards);
			case "newest-first":
				return this.sortByCreatedAtDesc(cards);
			default:
				return this.shuffle(cards);
		}
	}

	private sortReviewCards(
		cards: FSRSFlashcardItem[],
		order: ReviewOrder,
		fsrsService: FSRSService,
	): FSRSFlashcardItem[] {
		switch (order) {
			case "due-date":
				return fsrsService.sortByDue(cards);
			case "random":
				return this.shuffle(cards);
			case "due-date-random": {
				// Sort by due date, then shuffle within same-day groups
				const sorted = fsrsService.sortByDue(cards);
				const groupedByDue = new Map<string, FSRSFlashcardItem[]>();
				for (const card of sorted) {
					const dueDay =
						new Date(card.fsrs.due).toISOString().split("T")[0] ?? "";
					if (!groupedByDue.has(dueDay)) {
						groupedByDue.set(dueDay, []);
					}
					groupedByDue.get(dueDay)?.push(card);
				}
				const result: FSRSFlashcardItem[] = [];
				for (const [, group] of groupedByDue) {
					result.push(...this.shuffle(group));
				}
				return result;
			}
			case "by-retrievability":
				return fsrsService.sortByRetrievability(cards);
			case "most-lapses":
				return [...cards].sort((a, b) => b.fsrs.lapses - a.fsrs.lapses);
			case "relative-overdueness": {
				const now = Date.now();
				return [...cards].sort((a, b) => {
					const aOverdue =
						(now - new Date(a.fsrs.due).getTime()) /
						Math.max(1, a.fsrs.scheduledDays * 86_400_000);
					const bOverdue =
						(now - new Date(b.fsrs.due).getTime()) /
						Math.max(1, b.fsrs.scheduledDays * 86_400_000);
					return bOverdue - aOverdue;
				});
			}
			case "lowest-stability":
				return [...cards].sort((a, b) => a.fsrs.stability - b.fsrs.stability);
			case "order-added":
				return this.sortByCreatedAt(cards);
			default:
				return fsrsService.sortByDue(cards);
		}
	}

	private mixQueues(
		reviews: FSRSFlashcardItem[],
		newCards: FSRSFlashcardItem[],
		mix: NewReviewMix,
	): FSRSFlashcardItem[] {
		switch (mix) {
			case "show-after-reviews":
				return [...reviews, ...newCards];
			case "show-before-reviews":
				return [...newCards, ...reviews];
			default:
				return this.interleave(reviews, newCards);
		}
	}

	private buildCustomStudyQueue(
		availableCards: FSRSFlashcardItem[],
		fsrsService: FSRSService,
		options: QueueBuildOptions,
	): FSRSFlashcardItem[] {
		const allLearningCards = fsrsService.getLearningCards(availableCards);

		// All learning cards treated as due (no pending)
		const dueLearningCards = allLearningCards;

		// All review state cards included
		const reviewCards = availableCards.filter(
			(card) => card.fsrs.state === State.Review,
		);
		const effectiveReviewsLimit = options.ignoreDailyLimits
			? reviewCards.length
			: Math.max(
					0,
					options.reviewsLimit - (options.reviewsCompletedToday ?? 0),
				);
		const limitedReviewCards = this.sortReviewCards(
			reviewCards.slice(0, effectiveReviewsLimit),
			options.reviewOrder ?? "due-date",
			fsrsService,
		);

		// New cards
		const newLimit = options.ignoreDailyLimits
			? Infinity
			: options.newCardsLimit - (options.newCardsStudiedToday ?? 0);
		const newCards = this.sortNewCards(
			fsrsService.getNewCards(availableCards, Math.max(0, newLimit)),
			options.newCardOrder ?? "random",
		);

		const mainQueue = this.mixQueues(
			limitedReviewCards,
			newCards,
			options.newReviewMix ?? "mix-with-reviews",
		);

		return [...fsrsService.sortByDue(dueLearningCards), ...mainQueue];
	}

	private buildStandardQueue(
		availableCards: FSRSFlashcardItem[],
		fsrsService: FSRSService,
		options: QueueBuildOptions,
		now: Date,
	): FSRSFlashcardItem[] {
		const allLearningCards = fsrsService.getLearningCards(availableCards);

		// Split learning cards by due status
		// For Learning cards: use strict check (must be actually due, not just within learn-ahead)
		// This aligns with isCardDueNow() which doesn't apply learn-ahead to Learning cards
		const dueLearningCards = allLearningCards.filter(
			(card) => new Date(card.fsrs.due) <= now,
		);
		const pendingLearningCards = allLearningCards.filter(
			(card) => new Date(card.fsrs.due) > now,
		);

		const dayStartHour = options.dayStartHour ?? 4;
		const reviewCards = fsrsService.getReviewCards(
			availableCards,
			now,
			dayStartHour,
		);
		const effectiveReviewsLimit = options.ignoreDailyLimits
			? reviewCards.length
			: Math.max(
					0,
					options.reviewsLimit - (options.reviewsCompletedToday ?? 0),
				);
		const limitedReviewCards = this.sortReviewCards(
			reviewCards.slice(0, effectiveReviewsLimit),
			options.reviewOrder ?? "due-date",
			fsrsService,
		);

		// New cards
		const newLimit = options.ignoreDailyLimits
			? Infinity
			: Math.max(
					0,
					options.newCardsLimit - (options.newCardsStudiedToday ?? 0),
				);
		const newCards = this.sortNewCards(
			fsrsService.getNewCards(availableCards, newLimit),
			options.newCardOrder ?? "random",
		);

		const mainQueue = this.mixQueues(
			limitedReviewCards,
			newCards,
			options.newReviewMix ?? "mix-with-reviews",
		);

		return [
			...fsrsService.sortByDue(dueLearningCards),
			...mainQueue,
			...fsrsService.sortByDue(pendingLearningCards),
		];
	}

	/** Order (Anki-like): Due Learning → Review → New → Pending Learning */
	buildQueue(
		allCards: FSRSFlashcardItem[],
		fsrsService: FSRSService,
		options: QueueBuildOptions,
	): FSRSFlashcardItem[] {
		const { now, todayBoundary, weekAgoBoundary } = this.calculateBoundaries(
			options.dayStartHour,
		);
		const reviewedToday = options.reviewedToday ?? new Set<string>();

		// Filter cards based on options
		const filteredCards = this.filterCards(
			allCards,
			options,
			todayBoundary,
			weekAgoBoundary,
		);

		// Exclude already reviewed cards (but keep learning cards - they need multiple reviews)
		const availableCards = filteredCards.filter((card) => {
			const isLearning =
				card.fsrs.state === State.Learning ||
				card.fsrs.state === State.Relearning;
			return isLearning || !reviewedToday.has(card.id);
		});

		let queue: FSRSFlashcardItem[];

		if (options.bypassScheduling) {
			queue = this.buildCustomStudyQueue(availableCards, fsrsService, options);
		} else {
			queue = this.buildStandardQueue(
				availableCards,
				fsrsService,
				options,
				now,
			);
		}

		if (
			options.cardLimit &&
			options.cardLimit > 0 &&
			queue.length > options.cardLimit
		) {
			// Preserve pending learning cards that would be cut off - they need
			// follow-up reviews within the session
			const pendingLearning = queue.slice(options.cardLimit).filter((card) => {
				const isLearning =
					card.fsrs.state === State.Learning ||
					card.fsrs.state === State.Relearning;
				return isLearning && new Date(card.fsrs.due) > now;
			});
			queue = [...queue.slice(0, options.cardLimit), ...pendingLearning];
		}

		return queue;
	}

	processAnswer(
		card: FSRSFlashcardItem,
		rating: Grade,
		fsrsService: FSRSService,
		responseTime: number,
		presetSettings?: import("@shared/types/settings.types").FSRSSettings,
	): {
		updatedCard: FSRSFlashcardItem;
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
							(1000 * 60 * 60 * 24),
					),
				)
			: 0;

		const newFsrsData = fsrsService.scheduleCard(
			card.fsrs,
			rating,
			now,
			presetSettings,
		);

		const updatedCard: FSRSFlashcardItem = {
			...card,
			fsrs: newFsrsData,
		};

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

	async gradeCard(
		card: FSRSFlashcardItem,
		rating: Grade,
		fsrsService: FSRSService,
		flashcardManager: FlashcardManager,
		responseTime: number = 0,
	): Promise<{ updatedCard: FSRSFlashcardItem; result: ReviewResult }> {
		// 1. Calculate new FSRS data
		const { updatedCard, result } = this.processAnswer(
			card,
			rating,
			fsrsService,
			responseTime,
		);

		// 2. Save to store
		if (card.id) {
			flashcardManager.updateCardFSRS(card.id, updatedCard.fsrs);

			notifyCardChange({
				type: "reviewed",
				cardId: card.id,
				rating: rating as number,
				newState: updatedCard.fsrs.state,
			});
		}

		return { updatedCard, result };
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
		allCards: FSRSFlashcardItem[],
		todayResults: ReviewResult[],
		settings: { newCardsPerDay: number; reviewsPerDay: number },
		dayBoundaryService?: import("@features/core/services/day-boundary.service").DayBoundaryService,
	): DailyStats {
		const now = new Date();
		const todayStart = new Date(now);
		todayStart.setHours(0, 0, 0, 0);
		const todayEnd = new Date(now);
		todayEnd.setHours(23, 59, 59, 999);

		// Count new cards reviewed today
		const newReviewedToday = todayResults.filter(
			(r) => r.previousState === State.New,
		).length;

		// Count due cards for today using day-based scheduling if service provided
		const dueToday = dayBoundaryService
			? dayBoundaryService.countDueCards(allCards, now)
			: allCards.filter((card) => {
					const dueDate = new Date(card.fsrs.due);
					return dueDate <= todayEnd && card.fsrs.state !== State.New;
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
			date: todayStart.toISOString().split("T")[0] ?? "",
		};
	}

	/**
	 * Check if a card should be re-added to queue (for learning cards)
	 * Learning/Relearning cards are ALWAYS requeued - the position is determined
	 * by getRequeuePosition(). Cards due soon go near the front, cards due later
	 * go at the end where getPhase() will trigger the waiting screen.
	 */
	shouldRequeue(card: FSRSFlashcardItem): boolean {
		return (
			card.fsrs.state === State.Learning || card.fsrs.state === State.Relearning
		);
	}

	getRequeuePosition(
		queue: FSRSFlashcardItem[],
		startIndex: number,
		card: FSRSFlashcardItem,
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

		const successfulReviews = results.filter(
			(r) => r.rating >= Rating.Good,
		).length;

		return successfulReviews / results.length;
	}

	getStreakInfo(
		reviewHistory: ReviewResult[],
		dayBoundaryService?: DayBoundaryService,
	): {
		currentStreak: number;
		longestStreak: number;
	} {
		if (reviewHistory.length === 0) {
			return { currentStreak: 0, longestStreak: 0 };
		}

		// Format date as local YYYY-MM-DD, respecting dayStartHour if service provided
		const formatDate = (timestamp: number): string => {
			if (dayBoundaryService) {
				// Use dayStartHour-aware formatting: a 3 AM review counts as "yesterday"
				const boundary = dayBoundaryService.getTodayBoundary(
					new Date(timestamp),
				);
				return dayBoundaryService.formatLocalDate(boundary);
			}
			// Fallback: local date without dayStartHour (avoids UTC issues)
			const d = new Date(timestamp);
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			return `${year}-${month}-${day}`;
		};

		const reviewDays = new Set(
			reviewHistory.map((r) => formatDate(r.timestamp)),
		);

		const sortedDays = Array.from(reviewDays).sort();

		let currentStreak = 0;
		let longestStreak = 0;
		let streak = 0;

		const now = Date.now();
		const today = formatDate(now);
		const yesterday = formatDate(now - 86400000);

		// Helper to add one day to YYYY-MM-DD string (avoids Date object creation in loop)
		const addOneDay = (dateStr: string): string => {
			const parts = dateStr.split("-").map(Number);
			const d = new Date(
				parts[0] as number,
				(parts[1] as number) - 1,
				parts[2] as number,
			);
			d.setDate(d.getDate() + 1);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		};

		for (let i = 0; i < sortedDays.length; i++) {
			const currentDay = sortedDays[i];
			if (!currentDay) continue;

			if (i === 0) {
				streak = 1;
			} else {
				const prevDay = sortedDays[i - 1];
				if (!prevDay) continue;

				// Compare strings directly - check if currentDay is exactly one day after prevDay
				const expectedNextDay = addOneDay(prevDay);
				if (currentDay === expectedNextDay) {
					streak++;
				} else {
					streak = 1;
				}
			}

			longestStreak = Math.max(longestStreak, streak);

			// Check if this contributes to current streak
			if (currentDay === today || currentDay === yesterday) {
				currentStreak = streak;
			}
		}

		// If last review wasn't today or yesterday, current streak is 0
		const lastDay = sortedDays[sortedDays.length - 1];
		if (lastDay !== today && lastDay !== yesterday) {
			currentStreak = 0;
		}

		return { currentStreak, longestStreak };
	}
}
