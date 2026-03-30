import { type Grade, Rating, State } from "ts-fsrs";
import {
	LEARN_AHEAD_LIMIT_MINUTES,
	RANDOM_QUEUE_INSERT_MAX_POS,
	WEAK_CARD_STABILITY_THRESHOLD,
} from "../constants";
import { notifyCardChange } from "../events";
import type { FlashcardManager } from "../flashcard/flashcard.service";
import type {
	CardSchedulingMeta,
	DailyStats,
	ReviewResult,
	ReviewSessionStats,
} from "../types";
import type {
	NewCardOrder,
	NewReviewMix,
	ReviewOrder,
} from "../types/settings.types";
import {
	formatLocalDate,
	getTodayBoundary,
	getTomorrowBoundary,
} from "../utils";
import type { FSRSService } from "./fsrs.service";

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

	private sortByCreatedAt(cards: CardSchedulingMeta[]): CardSchedulingMeta[] {
		return [...cards].sort((a, b) => {
			const aTime = a.fsrs.createdAt ?? 0;
			const bTime = b.fsrs.createdAt ?? 0;
			if (aTime !== bTime) return aTime - bTime;
			// Fallback to ID for deterministic order
			return a.id.localeCompare(b.id);
		});
	}

	private sortByCreatedAtDesc(
		cards: CardSchedulingMeta[],
	): CardSchedulingMeta[] {
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
		cards: CardSchedulingMeta[],
		options: QueueBuildOptions,
		todayBoundary: Date,
		weekAgoBoundary: Date,
	): CardSchedulingMeta[] {
		const noteSet = options.sourceNoteFilters?.length
			? new Set(options.sourceNoteFilters)
			: null;

		return cards.filter((card) => {
			// Source UID filter (used for project-scoped review)
			if (options.sourceUidFilter) {
				if (!card.sourceUid || !options.sourceUidFilter.has(card.sourceUid))
					return false;
			}

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

			return true;
		});
	}

	private sortNewCards(
		cards: CardSchedulingMeta[],
		order: NewCardOrder,
	): CardSchedulingMeta[] {
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
		cards: CardSchedulingMeta[],
		order: ReviewOrder,
		fsrsService: FSRSService,
	): CardSchedulingMeta[] {
		switch (order) {
			case "due-date":
				return fsrsService.sortByDue(cards);
			case "random":
				return this.shuffle(cards);
			case "due-date-random": {
				// Sort by due date, then shuffle within same-day groups
				const sorted = fsrsService.sortByDue(cards);
				const groupedByDue = new Map<string, CardSchedulingMeta[]>();
				for (const card of sorted) {
					const dueDay =
						new Date(card.fsrs.due).toISOString().split("T")[0] ?? "";
					if (!groupedByDue.has(dueDay)) {
						groupedByDue.set(dueDay, []);
					}
					groupedByDue.get(dueDay)?.push(card);
				}
				const result: CardSchedulingMeta[] = [];
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

	/**
	 * When burySiblings is off, spread IO/cloze siblings apart in the queue
	 * so cards from the same note don't appear back-to-back.
	 */
	spaceSiblings(queue: CardSchedulingMeta[]): CardSchedulingMeta[] {
		if (queue.length <= 2) return queue;

		// Build noteId → indices map (only IO and cloze cards have meaningful siblings)
		const noteGroups = new Map<string, number>();
		const hasMultiple = new Set<string>();

		for (const card of queue) {
			const key = this.getSiblingKey(card);
			if (!key) continue;
			if (noteGroups.has(key)) {
				hasMultiple.add(key);
			}
			noteGroups.set(key, (noteGroups.get(key) ?? 0) + 1);
		}

		if (hasMultiple.size === 0) return queue;

		// Greedy spacing: track last position of each sibling group
		const result: CardSchedulingMeta[] = [];
		const deferred: CardSchedulingMeta[] = [];
		const lastSeen = new Map<string, number>();
		const minSpacing = Math.max(
			3,
			Math.ceil(
				queue.length /
					Math.max(...[...hasMultiple].map((k) => noteGroups.get(k) ?? 1)),
			),
		);

		for (const card of queue) {
			const key = this.getSiblingKey(card);
			if (key && hasMultiple.has(key)) {
				const last = lastSeen.get(key);
				if (last !== undefined && result.length - last < minSpacing) {
					deferred.push(card);
					continue;
				}
				lastSeen.set(key, result.length);
			}
			result.push(card);
		}

		// Re-insert deferred cards at spaced positions
		for (const card of deferred) {
			const key = this.getSiblingKey(card);
			if (!key) continue;
			const last = lastSeen.get(key) ?? -minSpacing;
			const targetPos = Math.min(last + minSpacing, result.length);
			result.splice(targetPos, 0, card);
			lastSeen.set(key, targetPos);
		}

		return result;
	}

	private getSiblingKey(card: CardSchedulingMeta): string | null {
		if (card.cardType === "image-occlusion" && card.noteId) {
			return `io:${card.noteId}`;
		}
		if (card.cardType === "cloze" && card.noteId) {
			return `cloze:${card.noteId}`;
		}
		return null;
	}

	private mixQueues(
		reviews: CardSchedulingMeta[],
		newCards: CardSchedulingMeta[],
		mix: NewReviewMix,
	): CardSchedulingMeta[] {
		switch (mix) {
			case "show-after-reviews":
				return [...reviews, ...newCards];
			case "show-before-reviews":
				return [...newCards, ...reviews];
			default:
				return this.interleave(reviews, newCards);
		}
	}

	private usePerPresetLimits(options: QueueBuildOptions): boolean {
		return Boolean(
			options.cardPresetById &&
				options.presetDailyLimits &&
				options.presetProgressToday,
		);
	}

	private applyPerPresetLimit(
		cards: CardSchedulingMeta[],
		options: QueueBuildOptions,
		type: "new" | "review",
	): CardSchedulingMeta[] {
		const presetLimits = options.presetDailyLimits;
		const presetProgress = options.presetProgressToday;
		const cardPresetById = options.cardPresetById;
		if (!presetLimits || !presetProgress || !cardPresetById) return cards;

		const remainingByPreset = new Map<string, number>();
		for (const [presetName, limits] of presetLimits) {
			const progress = presetProgress.get(presetName);
			const dailyLimit =
				type === "new" ? limits.newCardsPerDay : limits.reviewsPerDay;
			const completed =
				type === "new"
					? (progress?.newStudied ?? 0)
					: (progress?.reviewsCompleted ?? 0);
			remainingByPreset.set(presetName, Math.max(0, dailyLimit - completed));
		}

		const fallbackPresetName = options.defaultPresetName ?? "Default";
		if (!remainingByPreset.has(fallbackPresetName)) {
			const fallbackLimit =
				type === "new" ? options.newCardsLimit : options.reviewsLimit;
			const fallbackDone =
				type === "new"
					? (options.newCardsStudiedToday ?? 0)
					: (options.reviewsCompletedToday ?? 0);
			remainingByPreset.set(
				fallbackPresetName,
				Math.max(0, fallbackLimit - fallbackDone),
			);
		}

		const result: CardSchedulingMeta[] = [];
		for (const card of cards) {
			const presetName = cardPresetById.get(card.id) ?? fallbackPresetName;

			// If preset is missing from limits map, fall back to global limits.
			if (!remainingByPreset.has(presetName)) {
				const fallbackLimit =
					type === "new" ? options.newCardsLimit : options.reviewsLimit;
				const presetDone =
					type === "new"
						? (presetProgress.get(presetName)?.newStudied ?? 0)
						: (presetProgress.get(presetName)?.reviewsCompleted ?? 0);
				remainingByPreset.set(
					presetName,
					Math.max(0, fallbackLimit - presetDone),
				);
			}

			const remaining = remainingByPreset.get(presetName) ?? 0;
			if (remaining <= 0) continue;

			result.push(card);
			remainingByPreset.set(presetName, remaining - 1);
		}

		return result;
	}

	private buildCustomStudyQueue(
		availableCards: CardSchedulingMeta[],
		fsrsService: FSRSService,
		options: QueueBuildOptions,
	): CardSchedulingMeta[] {
		const allLearningCards = fsrsService.getLearningCards(availableCards);

		// All learning cards treated as due (no pending)
		const dueLearningCards = allLearningCards;

		// All review state cards included
		const reviewCards = availableCards.filter(
			(card) => card.fsrs.state === State.Review,
		);
		const sortedReviewCards = this.sortReviewCards(
			reviewCards,
			options.reviewOrder ?? "due-date",
			fsrsService,
		);
		const limitedReviewCards = options.ignoreDailyLimits
			? sortedReviewCards
			: this.usePerPresetLimits(options)
				? this.applyPerPresetLimit(sortedReviewCards, options, "review")
				: sortedReviewCards.slice(
						0,
						Math.max(
							0,
							options.reviewsLimit - (options.reviewsCompletedToday ?? 0),
						),
					);

		// New cards
		const sortedNewCards = this.sortNewCards(
			fsrsService.getNewCards(availableCards),
			options.newCardOrder ?? "random",
		);
		const newCards = options.ignoreDailyLimits
			? sortedNewCards
			: this.usePerPresetLimits(options)
				? this.applyPerPresetLimit(sortedNewCards, options, "new")
				: sortedNewCards.slice(
						0,
						Math.max(
							0,
							options.newCardsLimit - (options.newCardsStudiedToday ?? 0),
						),
					);

		const mainQueue = this.mixQueues(
			limitedReviewCards,
			newCards,
			options.newReviewMix ?? "mix-with-reviews",
		);

		const spacedQueue =
			options.burySiblings === false
				? this.spaceSiblings(mainQueue)
				: mainQueue;

		return [...fsrsService.sortByDue(dueLearningCards), ...spacedQueue];
	}

	private buildStandardQueue(
		availableCards: CardSchedulingMeta[],
		fsrsService: FSRSService,
		options: QueueBuildOptions,
		now: Date,
	): CardSchedulingMeta[] {
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
		const sortedReviewCards = this.sortReviewCards(
			reviewCards,
			options.reviewOrder ?? "due-date",
			fsrsService,
		);
		const limitedReviewCards = options.ignoreDailyLimits
			? sortedReviewCards
			: this.usePerPresetLimits(options)
				? this.applyPerPresetLimit(sortedReviewCards, options, "review")
				: sortedReviewCards.slice(
						0,
						Math.max(
							0,
							options.reviewsLimit - (options.reviewsCompletedToday ?? 0),
						),
					);

		// New cards
		const sortedNewCards = this.sortNewCards(
			fsrsService.getNewCards(availableCards),
			options.newCardOrder ?? "random",
		);
		const newCards = options.ignoreDailyLimits
			? sortedNewCards
			: this.usePerPresetLimits(options)
				? this.applyPerPresetLimit(sortedNewCards, options, "new")
				: sortedNewCards.slice(
						0,
						Math.max(
							0,
							options.newCardsLimit - (options.newCardsStudiedToday ?? 0),
						),
					);

		const mainQueue = this.mixQueues(
			limitedReviewCards,
			newCards,
			options.newReviewMix ?? "mix-with-reviews",
		);

		const spacedQueue =
			options.burySiblings === false
				? this.spaceSiblings(mainQueue)
				: mainQueue;

		return [
			...fsrsService.sortByDue(dueLearningCards),
			...spacedQueue,
			...fsrsService.sortByDue(pendingLearningCards),
		];
	}

	/** Order (Anki-like): Due Learning → Review → New → Pending Learning */
	buildQueue(
		allCards: CardSchedulingMeta[],
		fsrsService: FSRSService,
		options: QueueBuildOptions,
	): CardSchedulingMeta[] {
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

		let queue: CardSchedulingMeta[];

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

	processAnswer<T extends CardSchedulingMeta>(
		card: T,
		rating: Grade,
		fsrsService: FSRSService,
		responseTime: number,
		presetSettings?: import("../types/settings.types").FSRSSettings,
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
				notifyCardChange({
					type: "reviewed",
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
		return (
			card.fsrs.state === State.Learning || card.fsrs.state === State.Relearning
		);
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

		const DAY_MS = 86400000;
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
