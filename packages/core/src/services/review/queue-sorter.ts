import { MS_PER_DAY } from "../../constants";
import type { CardSchedulingMeta } from "../../types";
import type {
	NewCardOrder,
	NewReviewMix,
	ReviewOrder,
} from "../../types/settings.types";
import { formatLocalDate } from "../../utils/date.utils";
import type { FSRSService } from "../fsrs/fsrs.service";

function shuffle<T>(array: T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = result[i] as T;
		result[i] = result[j] as T;
		result[j] = temp;
	}
	return result;
}

function interleave<T>(primary: T[], secondary: T[]): T[] {
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

function sortByCreatedAt(cards: CardSchedulingMeta[]): CardSchedulingMeta[] {
	return [...cards].sort((a, b) => {
		const aTime = a.fsrs.createdAt ?? 0;
		const bTime = b.fsrs.createdAt ?? 0;
		if (aTime !== bTime) return aTime - bTime;
		return a.id.localeCompare(b.id);
	});
}

function sortByCreatedAtDesc(
	cards: CardSchedulingMeta[],
): CardSchedulingMeta[] {
	return [...cards].sort((a, b) => {
		const aTime = a.fsrs.createdAt ?? 0;
		const bTime = b.fsrs.createdAt ?? 0;
		if (aTime !== bTime) return bTime - aTime;
		return b.id.localeCompare(a.id);
	});
}

export function sortNewCards(
	cards: CardSchedulingMeta[],
	order: NewCardOrder,
): CardSchedulingMeta[] {
	switch (order) {
		case "random":
			return shuffle(cards);
		case "oldest-first":
			return sortByCreatedAt(cards);
		case "newest-first":
			return sortByCreatedAtDesc(cards);
		default: {
			order satisfies never;
			return shuffle(cards);
		}
	}
}

export function sortReviewCards(
	cards: CardSchedulingMeta[],
	order: ReviewOrder,
	fsrsService: FSRSService,
): CardSchedulingMeta[] {
	switch (order) {
		case "due-date":
			return fsrsService.sortByDue(cards);
		case "random":
			return shuffle(cards);
		case "due-date-random": {
			const sorted = fsrsService.sortByDue(cards);
			const groupedByDue = new Map<string, CardSchedulingMeta[]>();
			for (const card of sorted) {
				// Bucket by the user's local calendar day — UTC keys split one
				// local day into two shuffle groups away from UTC.
				const dueDay = formatLocalDate(new Date(card.fsrs.due));
				if (!groupedByDue.has(dueDay)) {
					groupedByDue.set(dueDay, []);
				}
				groupedByDue.get(dueDay)?.push(card);
			}
			const result: CardSchedulingMeta[] = [];
			for (const [, group] of groupedByDue) {
				result.push(...shuffle(group));
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
					Math.max(1, a.fsrs.scheduledDays * MS_PER_DAY);
				const bOverdue =
					(now - new Date(b.fsrs.due).getTime()) /
					Math.max(1, b.fsrs.scheduledDays * MS_PER_DAY);
				return bOverdue - aOverdue;
			});
		}
		case "lowest-stability":
			return [...cards].sort((a, b) => a.fsrs.stability - b.fsrs.stability);
		case "order-added":
			return sortByCreatedAt(cards);
		default: {
			order satisfies never;
			return fsrsService.sortByDue(cards);
		}
	}
}

export function mixQueues(
	reviews: CardSchedulingMeta[],
	newCards: CardSchedulingMeta[],
	mix: NewReviewMix,
): CardSchedulingMeta[] {
	switch (mix) {
		case "show-after-reviews":
			return [...reviews, ...newCards];
		case "show-before-reviews":
			return [...newCards, ...reviews];
		case "mix-with-reviews":
			return interleave(reviews, newCards);
	}
}
