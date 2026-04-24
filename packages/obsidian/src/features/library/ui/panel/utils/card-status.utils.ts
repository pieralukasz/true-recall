import { State } from "ts-fsrs";

import type { FSRSFlashcardItem } from "@true-recall/core/types";

import {
	FSRS_COLORS,
	fsrsStateToColorName,
	type HighlightColor,
} from "@true-recall/obsidian/helpers/fsrs-colors";

interface StatusCounts {
	new: number;
	learning: number;
	review: number;
}

export function getStatusTitle(fsrsCard?: FSRSFlashcardItem): string {
	if (!fsrsCard) return "Unknown";
	switch (fsrsCard.fsrs.state) {
		case State.New:
			return "New";
		case State.Learning:
			return "Learning";
		case State.Relearning:
			return "Relearning";
		case State.Review:
			return "Review";
		default:
			return "Unknown";
	}
}

export function isSuspended(fsrsCard?: FSRSFlashcardItem): boolean {
	return fsrsCard?.fsrs.suspended === true;
}

export function isBuried(fsrsCard?: FSRSFlashcardItem): boolean {
	const buriedUntil = fsrsCard?.fsrs.buriedUntil;
	if (!buriedUntil) return false;
	return new Date(buriedUntil) > new Date();
}

export function getHighlightColor(
	fsrsCard?: FSRSFlashcardItem,
): HighlightColor {
	if (!fsrsCard) return "default";
	if (isSuspended(fsrsCard)) return FSRS_COLORS.suspended.name;
	if (isBuried(fsrsCard)) return "default";
	return fsrsStateToColorName(fsrsCard.fsrs.state) ?? "default";
}

export function countByState(
	cards: FSRSFlashcardItem[],
	reviewedToday?: Set<string>,
	dayStartHour = 4,
): StatusCounts {
	const counts: StatusCounts = { new: 0, learning: 0, review: 0 };
	const now = new Date();

	const todayBoundary = new Date(now);
	if (now.getHours() < dayStartHour) {
		todayBoundary.setDate(todayBoundary.getDate() - 1);
	}
	todayBoundary.setHours(dayStartHour, 0, 0, 0);
	const tomorrowBoundary = new Date(todayBoundary);
	tomorrowBoundary.setDate(tomorrowBoundary.getDate() + 1);

	for (const card of cards) {
		if (card.fsrs.suspended) continue;
		if (card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now)
			continue;

		const isLearning =
			card.fsrs.state === State.Learning ||
			card.fsrs.state === State.Relearning;
		if (!isLearning && reviewedToday?.has(card.id)) continue;

		switch (card.fsrs.state) {
			case State.New:
				counts.new++;
				break;
			case State.Learning:
			case State.Relearning:
				counts.learning++;
				break;
			case State.Review: {
				const dueDate = new Date(card.fsrs.due);
				if (dueDate < tomorrowBoundary) {
					counts.review++;
				}
				break;
			}
		}
	}
	return counts;
}
