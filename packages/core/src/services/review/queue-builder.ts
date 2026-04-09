import { Rating, State } from "ts-fsrs";
import { MS_PER_DAY, WEAK_CARD_STABILITY_THRESHOLD } from "../../constants";
import { isLearningState } from "../../helpers/card-state";
import type { CardSchedulingMeta } from "../../types";
import { getTodayBoundary, getTomorrowBoundary } from "../../utils";
import type { FSRSService } from "../fsrs/fsrs.service";
import { mixQueues, sortNewCards, sortReviewCards } from "./queue-sorter";
import type { QueueBuildOptions } from "./review.service";
import { spaceSiblings } from "./sibling-spacer";

function calculateBoundaries(dayStartHour: number = 4): {
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

function filterCards(
	cards: CardSchedulingMeta[],
	options: QueueBuildOptions,
	todayBoundary: Date,
	weekAgoBoundary: Date,
	reviewedToday?: Set<string>,
): CardSchedulingMeta[] {
	const noteSet = options.sourceNoteFilters?.length
		? new Set(options.sourceNoteFilters)
		: null;

	return cards.filter((card) => {
		// Exclude already reviewed (but keep learning cards)
		if (reviewedToday?.size) {
			if (!isLearningState(card.fsrs.state) && reviewedToday.has(card.id))
				return false;
		}
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
					Date.now() + options.studyAheadDays * MS_PER_DAY,
				);
				if (new Date(card.fsrs.due) > cutoff) return false;
			}
		}

		return true;
	});
}

function usePerPresetLimits(options: QueueBuildOptions): boolean {
	return Boolean(
		options.cardPresetById &&
			options.presetDailyLimits &&
			options.presetProgressToday,
	);
}

function applyPerPresetLimit(
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

function buildCustomStudyQueue(
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
	const sortedReviewCards = sortReviewCards(
		reviewCards,
		options.reviewOrder ?? "due-date",
		fsrsService,
	);
	const limitedReviewCards = options.ignoreDailyLimits
		? sortedReviewCards
		: usePerPresetLimits(options)
			? applyPerPresetLimit(sortedReviewCards, options, "review")
			: sortedReviewCards.slice(
					0,
					Math.max(
						0,
						options.reviewsLimit - (options.reviewsCompletedToday ?? 0),
					),
				);

	// New cards
	const sortedNewCards = sortNewCards(
		fsrsService.getNewCards(availableCards),
		options.newCardOrder ?? "random",
	);
	const newCards = options.ignoreDailyLimits
		? sortedNewCards
		: usePerPresetLimits(options)
			? applyPerPresetLimit(sortedNewCards, options, "new")
			: sortedNewCards.slice(
					0,
					Math.max(
						0,
						options.newCardsLimit - (options.newCardsStudiedToday ?? 0),
					),
				);

	const mainQueue = mixQueues(
		limitedReviewCards,
		newCards,
		options.newReviewMix ?? "mix-with-reviews",
	);

	const spacedQueue =
		options.burySiblings === false ? spaceSiblings(mainQueue) : mainQueue;

	return [...fsrsService.sortByDue(dueLearningCards), ...spacedQueue];
}

function buildStandardQueue(
	availableCards: CardSchedulingMeta[],
	fsrsService: FSRSService,
	options: QueueBuildOptions,
	now: Date,
): CardSchedulingMeta[] {
	// Single-pass classification: bucket cards by state instead of
	// 3 separate filter passes (getLearningCards + getReviewCards + getNewCards).
	const dueLearningCards: CardSchedulingMeta[] = [];
	const pendingLearningCards: CardSchedulingMeta[] = [];
	const rawNewCards: CardSchedulingMeta[] = [];
	const rawReviewCards: CardSchedulingMeta[] = [];

	const dayStartHour = options.dayStartHour ?? 4;
	const tomorrowBoundary = getTomorrowBoundary(dayStartHour, now);

	for (const card of availableCards) {
		switch (card.fsrs.state) {
			case State.Learning:
			case State.Relearning:
				if (new Date(card.fsrs.due) <= now) {
					dueLearningCards.push(card);
				} else {
					pendingLearningCards.push(card);
				}
				break;
			case State.New:
				rawNewCards.push(card);
				break;
			case State.Review:
				if (new Date(card.fsrs.due) < tomorrowBoundary) {
					rawReviewCards.push(card);
				}
				break;
		}
	}

	const sortedReviewCards = sortReviewCards(
		rawReviewCards,
		options.reviewOrder ?? "due-date",
		fsrsService,
	);
	const limitedReviewCards = options.ignoreDailyLimits
		? sortedReviewCards
		: usePerPresetLimits(options)
			? applyPerPresetLimit(sortedReviewCards, options, "review")
			: sortedReviewCards.slice(
					0,
					Math.max(
						0,
						options.reviewsLimit - (options.reviewsCompletedToday ?? 0),
					),
				);

	// New cards
	const sortedNewCards = sortNewCards(
		rawNewCards,
		options.newCardOrder ?? "random",
	);
	const newCards = options.ignoreDailyLimits
		? sortedNewCards
		: usePerPresetLimits(options)
			? applyPerPresetLimit(sortedNewCards, options, "new")
			: sortedNewCards.slice(
					0,
					Math.max(
						0,
						options.newCardsLimit - (options.newCardsStudiedToday ?? 0),
					),
				);

	const mainQueue = mixQueues(
		limitedReviewCards,
		newCards,
		options.newReviewMix ?? "mix-with-reviews",
	);

	const spacedQueue =
		options.burySiblings === false ? spaceSiblings(mainQueue) : mainQueue;

	return [
		...fsrsService.sortByDue(dueLearningCards),
		...spacedQueue,
		...fsrsService.sortByDue(pendingLearningCards),
	];
}

/** Order (Anki-like): Due Learning -> Review -> New -> Pending Learning */
export function buildQueue(
	allCards: CardSchedulingMeta[],
	fsrsService: FSRSService,
	options: QueueBuildOptions,
): CardSchedulingMeta[] {
	const { now, todayBoundary, weekAgoBoundary } = calculateBoundaries(
		options.dayStartHour,
	);
	const reviewedToday = options.reviewedToday ?? new Set<string>();

	// Combined filter + reviewed-today exclusion in one pass
	const availableCards = filterCards(
		allCards,
		options,
		todayBoundary,
		weekAgoBoundary,
		reviewedToday,
	);

	let queue: CardSchedulingMeta[];

	if (options.bypassScheduling) {
		queue = buildCustomStudyQueue(availableCards, fsrsService, options);
	} else {
		queue = buildStandardQueue(availableCards, fsrsService, options, now);
	}

	if (
		options.cardLimit &&
		options.cardLimit > 0 &&
		queue.length > options.cardLimit
	) {
		// Preserve pending learning cards that would be cut off - they need
		// follow-up reviews within the session
		const pendingLearning = queue.slice(options.cardLimit).filter((card) => {
			return isLearningState(card.fsrs.state) && new Date(card.fsrs.due) > now;
		});
		queue = [...queue.slice(0, options.cardLimit), ...pendingLearning];
	}

	return queue;
}
