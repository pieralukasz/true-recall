import { State } from "ts-fsrs";

import { isLearningState } from "../../helpers/card-state";
import type { CardSchedulingMeta } from "../../types";
import { getTomorrowBoundary } from "../../utils";
import type { FSRSService } from "../fsrs/fsrs.service";
import { calculateBoundaries, filterCards } from "./queue-filter";
import { mixQueues, sortNewCards, sortReviewCards } from "./queue-sorter";
import type { QueueBuildOptions } from "./review.service";
import { spaceSiblings } from "./sibling-spacer";

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

function buildAnkiCustomStudyQueue(
	availableCards: CardSchedulingMeta[],
	fsrsService: FSRSService,
	options: QueueBuildOptions,
): CardSchedulingMeta[] {
	const request = options.customStudy;
	if (!request) return availableCards;

	let queue: CardSchedulingMeta[];
	let limit: number | undefined;

	switch (request.kind) {
		case "increase-new":
			queue = sortNewCards(availableCards, "oldest-first");
			limit =
				Math.max(
					0,
					options.newCardsLimit - (options.newCardsStudiedToday ?? 0),
				) + request.amount;
			break;
		case "increase-review":
		case "review-ahead":
			queue = sortReviewCards(availableCards, "due-date", fsrsService);
			if (request.kind === "increase-review") {
				limit =
					Math.max(
						0,
						options.reviewsLimit - (options.reviewsCompletedToday ?? 0),
					) + request.amount;
			}
			break;
		case "forgotten":
			queue = sortReviewCards(availableCards, "random", fsrsService);
			break;
		case "actual-learning":
			queue = fsrsService.sortByDue(availableCards);
			break;
		case "preview-new":
			queue = sortNewCards(availableCards, "oldest-first");
			break;
		case "state-or-tag":
			queue =
				request.cardState === "new"
					? sortNewCards(availableCards, "oldest-first")
					: sortReviewCards(
							availableCards,
							request.cardState === "due" ? "due-date" : "random",
							fsrsService,
						);
			limit = request.cardLimit;
			break;
	}

	return limit && limit > 0 ? queue.slice(0, limit) : queue;
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

	if (options.materializedCardIds) {
		const cardById = new Map(availableCards.map((card) => [card.id, card]));
		queue = options.materializedCardIds.flatMap((id) => {
			const card = cardById.get(id);
			return card ? [card] : [];
		});
	} else if (options.customStudy) {
		queue = buildAnkiCustomStudyQueue(availableCards, fsrsService, options);
	} else if (options.bypassScheduling) {
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
