/**
 * Review Session Service
 * Manages review session logic: queue building, answer processing, statistics
 */
import { Rating, State, type Grade } from "ts-fsrs";
import type {
	FSRSFlashcardItem,
	ReviewResult,
	ReviewSessionStats,
	DailyStats,
} from "../../types";
import type { CardReviewedEvent } from "../../types/events.types";
import type {
	NewCardOrder,
	ReviewOrder,
	NewReviewMix,
} from "../../types/settings.types";
import type { FSRSService } from "../core/fsrs.service";
import type { FlashcardManager } from "../flashcard/flashcard.service";
import type { DayBoundaryService } from "../core/day-boundary.service";
import { LEARN_AHEAD_LIMIT_MINUTES } from "../../constants";
import { getEventBus } from "../core/event-bus.service";

/**
 * Options for building review queue
 */
export interface QueueBuildOptions {
	/** Maximum new cards to include */
	newCardsLimit: number;
	/** Maximum reviews to include */
	reviewsLimit: number;
	/** Cards already reviewed today (to exclude) */
	reviewedToday?: Set<string>;
	/** New cards already studied today */
	newCardsStudiedToday?: number;
	/** Filter by project names (many-to-many, card matches if it has ANY of these projects) */
	projectFilters?: string[];
	/** Map sourceUid -> projects for fallback resolution when card.projects is empty */
	sourceUidToProjects?: Map<string, string[]>;
	/** Order for new cards */
	newCardOrder?: NewCardOrder;
	/** Order for review cards */
	reviewOrder?: ReviewOrder;
	/** How to mix new cards with reviews */
	newReviewMix?: NewReviewMix;

	// Custom session filters
	/** Filter by source note name (sourceNoteName field) */
	sourceNoteFilter?: string;
	/** Filter by multiple source note names */
	sourceNoteFilters?: string[];
	/** Filter by flashcard file path */
	filePathFilter?: string;
	/** Only include cards created today */
	createdTodayOnly?: boolean;
	/** Only include cards created in the last 7 days */
	createdThisWeek?: boolean;
	/** Only include weak cards (stability < 7 days) */
	weakCardsOnly?: boolean;
	/** Filter by card state: due, learning, new, or buried */
	stateFilter?: "due" | "learning" | "new" | "buried";
	/** Ignore daily limits for custom sessions */
	ignoreDailyLimits?: boolean;
	/** Bypass scheduling - show all matching cards regardless of due date (like Anki Custom Study) */
	bypassScheduling?: boolean;
	/** Hour when new day starts (0-23, default 4 like Anki) */
	dayStartHour?: number;
}

/**
 * Service for managing review sessions
 */
export class ReviewService {
	/**
	 * Shuffle an array using Fisher-Yates algorithm
	 */
	private shuffle<T>(array: T[]): T[] {
		const result = [...array];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[result[i], result[j]] = [result[j]!, result[i]!];
		}
		return result;
	}

	/**
	 * Interleave two arrays (distribute items evenly)
	 */
	private interleave<T>(primary: T[], secondary: T[]): T[] {
		if (secondary.length === 0) return [...primary];
		if (primary.length === 0) return [...secondary];

		const result: T[] = [];
		const ratio = primary.length / secondary.length;
		let primaryIndex = 0;
		let secondaryIndex = 0;

		while (
			primaryIndex < primary.length ||
			secondaryIndex < secondary.length
		) {
			// Add primary cards based on ratio
			const targetPrimary = Math.floor((secondaryIndex + 1) * ratio);
			while (
				primaryIndex < targetPrimary &&
				primaryIndex < primary.length
			) {
				result.push(primary[primaryIndex]!);
				primaryIndex++;
			}
			// Add one secondary card
			if (secondaryIndex < secondary.length) {
				result.push(secondary[secondaryIndex]!);
				secondaryIndex++;
			}
		}
		// Add remaining primary cards
		while (primaryIndex < primary.length) {
			result.push(primary[primaryIndex]!);
			primaryIndex++;
		}

		return result;
	}

	/**
	 * Sort cards by creation date (oldest first)
	 * Falls back to card ID for cards without createdAt (backward compatibility)
	 */
	private sortByCreatedAt(cards: FSRSFlashcardItem[]): FSRSFlashcardItem[] {
		return [...cards].sort((a, b) => {
			const aTime = a.fsrs.createdAt ?? 0;
			const bTime = b.fsrs.createdAt ?? 0;
			if (aTime !== bTime) return aTime - bTime;
			// Fallback to ID for deterministic order
			return a.id.localeCompare(b.id);
		});
	}

	/**
	 * Sort cards by creation date (newest first)
	 */
	private sortByCreatedAtDesc(
		cards: FSRSFlashcardItem[]
	): FSRSFlashcardItem[] {
		return [...cards].sort((a, b) => {
			const aTime = a.fsrs.createdAt ?? 0;
			const bTime = b.fsrs.createdAt ?? 0;
			if (aTime !== bTime) return bTime - aTime;
			return b.id.localeCompare(a.id);
		});
	}

	/**
	 * Calculate date boundaries for filtering (respects dayStartHour like Anki)
	 */
	private calculateBoundaries(dayStartHour: number = 4): {
		now: Date;
		todayBoundary: Date;
		weekAgoBoundary: Date;
	} {
		const now = new Date();
		const todayBoundary = new Date(now);
		if (now.getHours() < dayStartHour) {
			todayBoundary.setDate(todayBoundary.getDate() - 1);
		}
		todayBoundary.setHours(dayStartHour, 0, 0, 0);

		const weekAgoBoundary = new Date(todayBoundary);
		weekAgoBoundary.setDate(weekAgoBoundary.getDate() - 7);

		return { now, todayBoundary, weekAgoBoundary };
	}

	/**
	 * Filter cards based on queue build options
	 */
	private filterCards(
		cards: FSRSFlashcardItem[],
		options: QueueBuildOptions,
		todayBoundary: Date,
		weekAgoBoundary: Date
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
				if (card.sourceNoteName !== options.sourceNoteFilter)
					return false;
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
				if (!createdAt || createdAt < todayBoundary.getTime())
					return false;
			}

			// Created this week filter
			if (options.createdThisWeek) {
				const createdAt = card.fsrs.createdAt;
				if (!createdAt || createdAt < weekAgoBoundary.getTime())
					return false;
			}

			// Weak cards filter
			if (options.weakCardsOnly && card.fsrs.stability >= 7) {
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
					cardProjects =
						options.sourceUidToProjects.get(card.sourceUid) || [];
				}

				// Normalize project names (strip [[...]] wiki-link brackets if present)
				const normalizeProjectName = (name: string): string =>
					name.replace(/^\[\[|\]\]$/g, "");

				const matches = cardProjects.some((p) =>
					projectSet.has(normalizeProjectName(p))
				);
				if (!matches) {
					return false;
				}
			}

			return true;
		});
	}

	/**
	 * Sort new cards based on order setting
	 */
	private sortNewCards(
		cards: FSRSFlashcardItem[],
		order: NewCardOrder
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

	/**
	 * Sort review cards based on order setting
	 */
	private sortReviewCards(
		cards: FSRSFlashcardItem[],
		order: ReviewOrder,
		fsrsService: FSRSService
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
						new Date(card.fsrs.due).toISOString().split("T")[0] ??
						"";
					if (!groupedByDue.has(dueDay)) {
						groupedByDue.set(dueDay, []);
					}
					groupedByDue.get(dueDay)!.push(card);
				}
				const result: FSRSFlashcardItem[] = [];
				for (const [, group] of groupedByDue) {
					result.push(...this.shuffle(group));
				}
				return result;
			}
			default:
				return fsrsService.sortByDue(cards);
		}
	}

	/**
	 * Mix review and new cards based on mix setting
	 */
	private mixQueues(
		reviews: FSRSFlashcardItem[],
		newCards: FSRSFlashcardItem[],
		mix: NewReviewMix
	): FSRSFlashcardItem[] {
		switch (mix) {
			case "show-after-reviews":
				return [...reviews, ...newCards];
			case "show-before-reviews":
				return [...newCards, ...reviews];
			case "mix-with-reviews":
			default:
				return this.interleave(reviews, newCards);
		}
	}

	/**
	 * Build queue with bypass scheduling (Custom Study mode)
	 */
	private buildCustomStudyQueue(
		availableCards: FSRSFlashcardItem[],
		fsrsService: FSRSService,
		options: QueueBuildOptions
	): FSRSFlashcardItem[] {
		const allLearningCards = fsrsService.getLearningCards(availableCards);

		// All learning cards treated as due (no pending)
		const dueLearningCards = allLearningCards;

		// All review state cards included
		const reviewCards = availableCards.filter(
			(card) => card.fsrs.state === State.Review
		);
		const effectiveReviewsLimit = options.ignoreDailyLimits
			? reviewCards.length
			: options.reviewsLimit;
		const limitedReviewCards = this.sortReviewCards(
			reviewCards.slice(0, effectiveReviewsLimit),
			options.reviewOrder ?? "due-date",
			fsrsService
		);

		// New cards
		const newLimit = options.ignoreDailyLimits
			? Infinity
			: options.newCardsLimit - (options.newCardsStudiedToday ?? 0);
		const newCards = this.sortNewCards(
			fsrsService.getNewCards(availableCards, Math.max(0, newLimit)),
			options.newCardOrder ?? "random"
		);

		const mainQueue = this.mixQueues(
			limitedReviewCards,
			newCards,
			options.newReviewMix ?? "mix-with-reviews"
		);

		return [...fsrsService.sortByDue(dueLearningCards), ...mainQueue];
	}

	/**
	 * Build queue with standard scheduling (respects due dates)
	 */
	private buildStandardQueue(
		availableCards: FSRSFlashcardItem[],
		fsrsService: FSRSService,
		options: QueueBuildOptions,
		now: Date
	): FSRSFlashcardItem[] {
		const learnAheadTime = new Date(
			now.getTime() + LEARN_AHEAD_LIMIT_MINUTES * 60 * 1000
		);
		const allLearningCards = fsrsService.getLearningCards(availableCards);

		// Split learning cards by due status
		const dueLearningCards = allLearningCards.filter(
			(card) => new Date(card.fsrs.due) <= learnAheadTime
		);
		const pendingLearningCards = allLearningCards.filter(
			(card) => new Date(card.fsrs.due) > learnAheadTime
		);

		// Get due review cards
		const dayStartHour = options.dayStartHour ?? 4;
		const reviewCards = fsrsService.getReviewCards(
			availableCards,
			now,
			dayStartHour
		);
		const effectiveReviewsLimit = options.ignoreDailyLimits
			? reviewCards.length
			: options.reviewsLimit;
		const limitedReviewCards = this.sortReviewCards(
			reviewCards.slice(0, effectiveReviewsLimit),
			options.reviewOrder ?? "due-date",
			fsrsService
		);

		// New cards
		const newLimit = options.ignoreDailyLimits
			? Infinity
			: Math.max(
					0,
					options.newCardsLimit - (options.newCardsStudiedToday ?? 0)
			  );
		const newCards = this.sortNewCards(
			fsrsService.getNewCards(availableCards, newLimit),
			options.newCardOrder ?? "random"
		);

		const mainQueue = this.mixQueues(
			limitedReviewCards,
			newCards,
			options.newReviewMix ?? "mix-with-reviews"
		);

		return [
			...fsrsService.sortByDue(dueLearningCards),
			...mainQueue,
			...fsrsService.sortByDue(pendingLearningCards),
		];
	}

	/**
	 * Build a review queue from all available cards
	 * Order (Anki-like): Due Learning → Review → New → Pending Learning
	 */
	buildQueue(
		allCards: FSRSFlashcardItem[],
		fsrsService: FSRSService,
		options: QueueBuildOptions
	): FSRSFlashcardItem[] {
		const { now, todayBoundary, weekAgoBoundary } =
			this.calculateBoundaries(options.dayStartHour);
		const reviewedToday = options.reviewedToday ?? new Set<string>();

		// Filter cards based on options
		const filteredCards = this.filterCards(
			allCards,
			options,
			todayBoundary,
			weekAgoBoundary
		);

		// Exclude already reviewed cards (but keep learning cards - they need multiple reviews)
		const availableCards = filteredCards.filter((card) => {
			const isLearning =
				card.fsrs.state === State.Learning ||
				card.fsrs.state === State.Relearning;
			return isLearning || !reviewedToday.has(card.id);
		});

		// Build queue based on scheduling mode
		if (options.bypassScheduling) {
			return this.buildCustomStudyQueue(
				availableCards,
				fsrsService,
				options
			);
		}

		return this.buildStandardQueue(
			availableCards,
			fsrsService,
			options,
			now
		);
	}

	/**
	 * Process an answer and return updated card data
	 */
	processAnswer(
		card: FSRSFlashcardItem,
		rating: Grade,
		fsrsService: FSRSService,
		responseTime: number
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
						(now.getTime() -
							new Date(card.fsrs.lastReview).getTime()) /
							(1000 * 60 * 60 * 24)
					)
			  )
			: 0;

		// Schedule the card
		const newFsrsData = fsrsService.scheduleCard(card.fsrs, rating, now);

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

	/**
	 * Grade a card and save FSRS data to store
	 * Single method for all grading operations (answer, move, etc.)
	 */
	async gradeCard(
		card: FSRSFlashcardItem,
		rating: Grade,
		fsrsService: FSRSService,
		flashcardManager: FlashcardManager,
		responseTime: number = 0
	): Promise<{ updatedCard: FSRSFlashcardItem; result: ReviewResult }> {
		// 1. Calculate new FSRS data
		const { updatedCard, result } = this.processAnswer(
			card,
			rating,
			fsrsService,
			responseTime
		);

		// 2. Save to store
		if (card.id) {
			flashcardManager.updateCardFSRS(card.id, updatedCard.fsrs);

			// Emit review event for stats updates
			getEventBus().emit({
				type: "card:reviewed",
				cardId: card.id,
				rating: rating as number,
				newState: updatedCard.fsrs.state,
				timestamp: Date.now(),
			} as CardReviewedEvent);
		}

		return { updatedCard, result };
	}

	/**
	 * Calculate session statistics from review results
	 */
	calculateSessionStats(
		results: ReviewResult[],
		totalCards: number,
		startTime: number
	): ReviewSessionStats {
		const now = Date.now();

		return {
			total: totalCards,
			reviewed: results.length,
			again: results.filter((r) => r.rating === Rating.Again).length,
			hard: results.filter((r) => r.rating === Rating.Hard).length,
			good: results.filter((r) => r.rating === Rating.Good).length,
			easy: results.filter((r) => r.rating === Rating.Easy).length,
			newCards: results.filter((r) => r.previousState === State.New)
				.length,
			learningCards: results.filter(
				(r) =>
					r.previousState === State.Learning ||
					r.previousState === State.Relearning
			).length,
			reviewCards: results.filter((r) => r.previousState === State.Review)
				.length,
			duration: now - startTime,
		};
	}

	/**
	 * Calculate daily statistics
	 * @param dayBoundaryService Optional day boundary service for accurate due counts
	 */
	calculateDailyStats(
		allCards: FSRSFlashcardItem[],
		todayResults: ReviewResult[],
		settings: { newCardsPerDay: number; reviewsPerDay: number },
		dayBoundaryService?: import("../core/day-boundary.service").DayBoundaryService
	): DailyStats {
		const now = new Date();
		const todayStart = new Date(now);
		todayStart.setHours(0, 0, 0, 0);
		const todayEnd = new Date(now);
		todayEnd.setHours(23, 59, 59, 999);

		// Count new cards reviewed today
		const newReviewedToday = todayResults.filter(
			(r) => r.previousState === State.New
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
			settings.newCardsPerDay - newReviewedToday
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
	 */
	shouldRequeue(card: FSRSFlashcardItem): boolean {
		// Learning and relearning cards get re-added if their due time is soon
		if (
			card.fsrs.state === State.Learning ||
			card.fsrs.state === State.Relearning
		) {
			const dueDate = new Date(card.fsrs.due);
			const now = new Date();
			// Re-add if due within 10 minutes
			const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
			return dueDate <= tenMinutesFromNow;
		}
		return false;
	}

	/**
	 * Get the next position to insert a re-queued card
	 * @param queue Current queue of cards
	 * @param card Card to requeue
	 * @param reviewOrder Optional sort order - affects positioning strategy
	 */
	getRequeuePosition(
		queue: FSRSFlashcardItem[],
		card: FSRSFlashcardItem,
		reviewOrder?: "due-date" | "random" | "due-date-random"
	): number {
		const dueDate = new Date(card.fsrs.due);
		const now = new Date();

		// For random sort: insert learning cards near front with some randomness
		// Using due-date ordering in a shuffled queue would place cards incorrectly
		if (reviewOrder === "random") {
			const learnAheadTime = new Date(
				now.getTime() + LEARN_AHEAD_LIMIT_MINUTES * 60 * 1000
			);
			if (dueDate <= learnAheadTime) {
				// Card is due soon - insert randomly in first 5 positions
				const maxPos = Math.min(5, queue.length);
				return Math.floor(Math.random() * (maxPos + 1));
			}
			// Card not due yet - append to end
			return queue.length;
		}

		// For due-date or due-date-random: find position based on due time
		for (let i = 0; i < queue.length; i++) {
			const queueCard = queue[i];
			if (!queueCard) continue;
			const queueDue = new Date(queueCard.fsrs.due);
			if (dueDate < queueDue) {
				return i;
			}
		}
		return queue.length;
	}

	/**
	 * Calculate retention rate from review history
	 */
	calculateRetentionRate(results: ReviewResult[]): number {
		if (results.length === 0) return 0;

		const successfulReviews = results.filter(
			(r) => r.rating >= Rating.Good
		).length;

		return successfulReviews / results.length;
	}

	/**
	 * Get streak information (consecutive days of review)
	 * @param reviewHistory Array of review results with timestamps
	 * @param dayBoundaryService Optional service for dayStartHour-aware date formatting
	 */
	getStreakInfo(
		reviewHistory: ReviewResult[],
		dayBoundaryService?: DayBoundaryService
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
					new Date(timestamp)
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

		// Get unique review days using local dates
		const reviewDays = new Set(
			reviewHistory.map((r) => formatDate(r.timestamp))
		);

		const sortedDays = Array.from(reviewDays).sort();

		let currentStreak = 0;
		let longestStreak = 0;
		let streak = 0;

		const now = Date.now();
		const today = formatDate(now);
		const yesterday = formatDate(now - 86400000);

		for (let i = 0; i < sortedDays.length; i++) {
			const currentDay = sortedDays[i];
			if (!currentDay) continue;

			if (i === 0) {
				streak = 1;
			} else {
				const prevDay = sortedDays[i - 1];
				if (!prevDay) continue;

				const prevDate = new Date(prevDay);
				const currDate = new Date(currentDay);
				const diffDays = Math.floor(
					(currDate.getTime() - prevDate.getTime()) / 86400000
				);

				if (diffDays === 1) {
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
