import type { FSRSFlashcardItem } from "@shared/types";
import {
	FSRS_COLORS,
	fsrsStateToColor,
	fsrsStateToColorName,
	fsrsStateToCssVar,
	type HighlightColor,
} from "@shared/ui/helpers/fsrs-colors";
import { State } from "ts-fsrs";

export interface StatusCounts {
	new: number;
	learning: number;
	review: number;
}

export function getStatusDotColor(fsrsCard?: FSRSFlashcardItem): string {
	if (!fsrsCard) return "var(--text-muted)";
	return fsrsStateToCssVar(fsrsCard.fsrs.state);
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

export function getStatusBgClass(
	fsrsCard: FSRSFlashcardItem | undefined,
): string {
	if (!fsrsCard) return "ep:bg-obs-secondary";
	if (isSuspended(fsrsCard)) return FSRS_COLORS.suspended.bgCls;
	if (isBuried(fsrsCard)) return "ep:bg-obs-secondary";
	return fsrsStateToColor(fsrsCard.fsrs.state)?.bgCls ?? "ep:bg-obs-secondary";
}

export function getHighlightColor(
	fsrsCard?: FSRSFlashcardItem,
): HighlightColor {
	if (!fsrsCard) return "default";
	if (isSuspended(fsrsCard)) return FSRS_COLORS.suspended.name;
	if (isBuried(fsrsCard)) return "default";
	return fsrsStateToColorName(fsrsCard.fsrs.state) ?? "default";
}

export function getAggregateStatusDotColor(
	fsrsCards: (FSRSFlashcardItem | undefined)[],
): string {
	let hasNew = false;
	let hasLearning = false;
	let hasReview = false;

	for (const fsrs of fsrsCards) {
		if (!fsrs) continue;
		switch (fsrs.fsrs.state) {
			case State.New:
				hasNew = true;
				break;
			case State.Learning:
			case State.Relearning:
				hasLearning = true;
				break;
			case State.Review:
				hasReview = true;
				break;
		}
	}

	if (hasNew) return `var(${FSRS_COLORS.new.cssVar})`;
	if (hasLearning) return `var(${FSRS_COLORS.learning.cssVar})`;
	if (hasReview) return `var(${FSRS_COLORS.review.cssVar})`;
	return "var(--text-muted)";
}

export function getAggregateStatusTitle(
	fsrsCards: (FSRSFlashcardItem | undefined)[],
): string {
	const counts = { new: 0, learning: 0, review: 0 };
	for (const fsrs of fsrsCards) {
		if (!fsrs) continue;
		switch (fsrs.fsrs.state) {
			case State.New:
				counts.new++;
				break;
			case State.Learning:
			case State.Relearning:
				counts.learning++;
				break;
			case State.Review:
				counts.review++;
				break;
		}
	}
	const parts: string[] = [];
	if (counts.new > 0) parts.push(`${counts.new} new`);
	if (counts.learning > 0) parts.push(`${counts.learning} learning`);
	if (counts.review > 0) parts.push(`${counts.review} review`);
	return parts.join(", ") || "Unknown";
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
