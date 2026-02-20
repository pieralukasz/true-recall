import { State } from "ts-fsrs";
import type { BrowserStateFilter } from "@shared/store";
import type { FSRSFlashcardItem } from "@shared/types";

const TAG_RE = /<[^>]*>/g;
const CLOZE_RE = /\{\{c\d+::(.*?)(?:::[^}]*)?\}\}/g;

export function truncateText(text: string, maxLength: number): string {
	const plain = text.replace(TAG_RE, "").replace(CLOZE_RE, "$1").trim();
	if (plain.length <= maxLength) return plain;
	return `${plain.slice(0, maxLength)}\u2026`;
}

export function formatDueDate(due: string): string {
	const dueDate = new Date(due);
	const now = new Date();
	const diffMs = dueDate.getTime() - now.getTime();
	const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays < -1) return `${Math.abs(diffDays)}d ago`;
	if (diffDays === -1) return "Yesterday";
	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Tomorrow";
	if (diffDays < 30) return `In ${diffDays}d`;
	if (diffDays < 365) return `In ${Math.round(diffDays / 30)}mo`;
	return `In ${(diffDays / 365).toFixed(1)}y`;
}

export function formatIntervalDays(scheduledDays: number): string {
	if (scheduledDays <= 0) return "-";
	if (scheduledDays < 30) return `${scheduledDays}d`;
	if (scheduledDays < 365) return `${(scheduledDays / 30).toFixed(1)}mo`;
	return `${(scheduledDays / 365).toFixed(1)}y`;
}

export function matchesSearchQuery(
	card: FSRSFlashcardItem,
	query: string,
): boolean {
	if (!query) return true;
	const q = query.toLowerCase();
	return (
		card.question.toLowerCase().includes(q) ||
		card.answer.toLowerCase().includes(q) ||
		(card.sourceNoteName?.toLowerCase().includes(q) ?? false)
	);
}

export function matchesBrowserStateFilter(
	card: FSRSFlashcardItem,
	filter: BrowserStateFilter,
): boolean {
	if (filter === "all") return true;

	const now = new Date();
	if (filter === "suspended") return card.fsrs.suspended === true;
	if (filter === "buried") {
		return !!card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now;
	}

	if (card.fsrs.suspended) return false;
	if (card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now)
		return false;

	switch (filter) {
		case "new":
			return card.fsrs.state === State.New;
		case "learning":
			return card.fsrs.state === State.Learning;
		case "review":
			return card.fsrs.state === State.Review;
		case "relearning":
			return card.fsrs.state === State.Relearning;
	}
}
