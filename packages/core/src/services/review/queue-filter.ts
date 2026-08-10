import { Rating, State } from "ts-fsrs";

import { MS_PER_DAY, WEAK_CARD_STABILITY_THRESHOLD } from "../../constants";
import { isLearningState } from "../../helpers/card-state";
import type { CardSchedulingMeta } from "../../types";
import { getTodayBoundary } from "../../utils";
import type { QueueBuildOptions } from "./review.service";

function matchesCustomStudy(
	card: CardSchedulingMeta,
	options: QueueBuildOptions,
	todayBoundary: Date,
): boolean {
	const request = options.customStudy;
	if (!request) return true;

	const now = Date.now();
	switch (request.kind) {
		case "increase-new":
			return card.fsrs.state === State.New;
		case "increase-review":
			return (
				card.fsrs.state === State.Review &&
				new Date(card.fsrs.due).getTime() <= now
			);
		case "forgotten":
			return options.forgottenCardIds?.has(card.id) === true;
		case "actual-learning":
			return isLearningState(card.fsrs.state);
		case "review-ahead":
			return (
				card.fsrs.state !== State.New &&
				new Date(card.fsrs.due).getTime() <= now + request.days * MS_PER_DAY
			);
		case "preview-new": {
			const cutoff =
				todayBoundary.getTime() - (Math.max(1, request.days) - 1) * MS_PER_DAY;
			return (
				card.fsrs.state === State.New && (card.fsrs.createdAt ?? 0) >= cutoff
			);
		}
		case "state-or-tag": {
			const dueAt = new Date(card.fsrs.due).getTime();
			const matchesState = (() => {
				switch (request.cardState) {
					case "new":
						return card.fsrs.state === State.New;
					case "due":
						return card.fsrs.state !== State.New && dueAt <= now;
					case "review":
						return card.fsrs.state !== State.New;
					case "all":
						return true;
				}
			})();
			if (!matchesState) return false;

			const tags = new Set(card.tags ?? []);
			if (
				request.tagsToInclude.length > 0 &&
				!request.tagsToInclude.some((tag) => tags.has(tag))
			) {
				return false;
			}
			return !request.tagsToExclude.some((tag) => tags.has(tag));
		}
	}
}

export function calculateBoundaries(dayStartHour: number = 4): {
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

export function filterCards(
	cards: CardSchedulingMeta[],
	options: QueueBuildOptions,
	todayBoundary: Date,
	weekAgoBoundary: Date,
	reviewedToday?: Set<string>,
): CardSchedulingMeta[] {
	const noteSet = options.sourceNoteFilters?.length
		? new Set(options.sourceNoteFilters)
		: null;
	const materializedSet = options.materializedCardIds
		? new Set(options.materializedCardIds)
		: null;

	return cards.filter((card) => {
		if (options.temporaryDeckCardIds?.has(card.id)) return false;
		if (materializedSet && !materializedSet.has(card.id)) return false;

		// Exclude already reviewed (but keep learning cards)
		const respectsReviewedToday =
			!options.customStudy ||
			options.customStudy.kind === "increase-new" ||
			options.customStudy.kind === "increase-review";
		if (!materializedSet && respectsReviewedToday && reviewedToday?.size) {
			if (!isLearningState(card.fsrs.state) && reviewedToday.has(card.id))
				return false;
		}

		if (!materializedSet && !matchesCustomStudy(card, options, todayBoundary)) {
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
