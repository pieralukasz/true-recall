import { Rating, State } from "ts-fsrs";

import { MS_PER_DAY, WEAK_CARD_STABILITY_THRESHOLD } from "../../constants";
import { isLearningState } from "../../helpers/card-state";
import type { CardSchedulingMeta } from "../../types";
import { getTodayBoundary } from "../../utils";
import type { QueueBuildOptions } from "./review.service";

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
