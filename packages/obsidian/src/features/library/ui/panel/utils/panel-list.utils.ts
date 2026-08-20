import { State } from "ts-fsrs";

import { DayBoundaryService } from "@true-recall/core/services/review/day-boundary.service";
import type { FlashcardItem } from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";
import { stripMarkdownSyntax } from "@true-recall/core/utils";

import type { PanelItem } from "@true-recall/obsidian/features/library/ui/panel/group-cards";
import {
	isBuried,
	isSuspended,
} from "@true-recall/obsidian/features/library/ui/panel/utils/card-status.utils";

export type PanelStatusFilter = "all" | "due" | "suspended" | "buried";
export type PanelSort = "source" | "due" | "created" | "updated";

export interface PanelListOptions {
	query: string;
	status: PanelStatusFilter;
	sort: PanelSort;
	dayStartHour: number;
}

const MARKS_RE = /\p{Mark}/gu;

export function normalizeFullText(value: string): string {
	return stripMarkdownSyntax(value)
		.normalize("NFKD")
		.replace(MARKS_RE, "")
		.toLocaleLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

export function matchesCardSearch(
	question: string,
	answer: string,
	rawQuery: string,
): boolean {
	const terms = normalizeFullText(rawQuery).split(" ").filter(Boolean);
	if (terms.length === 0) return true;
	const haystack = normalizeFullText(`${question} ${answer}`);
	return terms.every((term) => haystack.includes(term));
}

export function getAnswerMatchSnippet(
	answer: string,
	rawQuery: string,
	maxLength = 96,
): string | null {
	const normalizedAnswer = normalizeFullText(answer);
	const firstMatchingTerm = normalizeFullText(rawQuery)
		.split(" ")
		.filter(Boolean)
		.find((term) => normalizedAnswer.includes(term));
	if (!firstMatchingTerm) return null;

	const plainAnswer = stripMarkdownSyntax(answer).replace(/\s+/g, " ").trim();
	if (plainAnswer.length <= maxLength) return plainAnswer;

	const normalizedPlain = normalizeFullText(plainAnswer);
	const matchIndex = normalizedPlain.indexOf(firstMatchingTerm);
	const halfWindow = Math.floor(maxLength / 2);
	const start = Math.max(0, matchIndex - halfWindow);
	const end = Math.min(plainAnswer.length, start + maxLength);
	return `${start > 0 ? "…" : ""}${plainAnswer.slice(start, end).trim()}${
		end < plainAnswer.length ? "…" : ""
	}`;
}

export function isPanelCardDue(
	card: FSRSFlashcardItem | undefined,
	dayStartHour: number,
	now = new Date(),
): boolean {
	if (!card || isSuspended(card) || isBuried(card)) return false;
	return new DayBoundaryService(dayStartHour).isCardDueToday(card, now);
}

export function getPanelCardStatus(
	card: FSRSFlashcardItem | undefined,
	dayStartHour: number,
	now = new Date(),
): { label: string; tone: "danger" | "warning" | "muted" } | null {
	if (!card) return null;
	if (isSuspended(card)) return { label: "Suspended", tone: "danger" };
	if (isBuried(card)) return { label: "Buried", tone: "muted" };
	if (!isPanelCardDue(card, dayStartHour, now)) return null;

	const due = new Date(card.fsrs.due);
	const today = new DayBoundaryService(dayStartHour).getTodayBoundary(now);
	const isOverdue = card.fsrs.state === State.Review && due < today;
	return isOverdue
		? { label: "Overdue", tone: "danger" }
		: { label: "Due today", tone: "warning" };
}

export function getPanelItemCardIds(item: PanelItem): string[] {
	return item.type === "card"
		? [item.card.id]
		: item.cards.map((card) => card.id);
}

export function getPanelItemRepresentative(item: PanelItem): FlashcardItem {
	if (item.type === "card") return item.card;
	const first = item.cards[0];
	if (!first) throw new Error("Image occlusion group cannot be empty");
	return first;
}

export function getPanelItemFsrsCards(
	item: PanelItem,
	fsrsMap: Map<string, FSRSFlashcardItem>,
): FSRSFlashcardItem[] {
	return getPanelItemCardIds(item)
		.map((id) => fsrsMap.get(id))
		.filter((card): card is FSRSFlashcardItem => card !== undefined);
}

export function filterAndSortPanelItems(
	items: PanelItem[],
	fsrsMap: Map<string, FSRSFlashcardItem>,
	options: PanelListOptions,
): PanelItem[] {
	const filtered = items.filter((item) => {
		const cards = item.type === "card" ? [item.card] : item.cards;
		if (
			!cards.some((card) =>
				matchesCardSearch(card.question, card.answer, options.query),
			)
		) {
			return false;
		}

		if (options.status === "all") return true;
		const fsrsCards = getPanelItemFsrsCards(item, fsrsMap);
		switch (options.status) {
			case "due":
				return fsrsCards.some((card) =>
					isPanelCardDue(card, options.dayStartHour),
				);
			case "suspended":
				return fsrsCards.some(isSuspended);
			case "buried":
				return fsrsCards.some(isBuried);
		}
		return false;
	});

	if (options.sort === "source") return filtered;

	const timestamp = (item: PanelItem): number => {
		const cards = getPanelItemFsrsCards(item, fsrsMap);
		if (cards.length === 0) return Number.POSITIVE_INFINITY;
		if (options.sort === "due") {
			return Math.min(
				...cards.map((card) => new Date(card.fsrs.due).getTime()),
			);
		}
		const field = options.sort === "created" ? "createdAt" : "updatedAt";
		return Math.max(...cards.map((card) => card.fsrs[field] ?? 0));
	};

	return filtered
		.map((item, index) => ({ item, index, timestamp: timestamp(item) }))
		.sort((a, b) => {
			const delta =
				options.sort === "due"
					? a.timestamp - b.timestamp
					: b.timestamp - a.timestamp;
			return delta || a.index - b.index;
		})
		.map(({ item }) => item);
}
