import { State } from "ts-fsrs";

import { MS_PER_DAY } from "@true-recall/core/constants";
import { computePriority } from "@true-recall/core/helpers/note-priority";
import { estimateStudyMinutes } from "@true-recall/core/helpers/time-estimate";
import type {
	DashboardAggregation,
	DashboardNoteEntry,
	NoteRetrievability,
} from "@true-recall/core/types/dashboard.types";
import type { CardSchedulingMeta } from "@true-recall/core/types/fsrs/card.types";
import type { TodaySummary } from "@true-recall/core/types/fsrs/stats.types";

/**
 * Supplied only when R-Mode is on. Without it the aggregation stays exactly as
 * it was, which is what keeps the due-date dashboard untouched.
 */
export interface RetrievabilityAggregationDeps {
	getRetrievability: (card: CardSchedulingMeta) => number;
	ceiling: number;
	comfortFloor: number;
	urgentBelow: number;
}

interface AggregationDeps {
	allCards: CardSchedulingMeta[];
	streakCurrent: number;
	todaySummary: TodaySummary;
	newCardsCap: number;
	reviewsCap: number;
	archivedSourceUids?: ReadonlySet<string>;
	retrievability?: RetrievabilityAggregationDeps;
}

export function emptyRetrievability(): NoteRetrievability {
	return {
		urgent: 0,
		losing: 0,
		known: 0,
		fresh: 0,
		pool: 0,
		total: 0,
		sumR: 0,
	};
}

function tallyRetrievability(
	target: NoteRetrievability,
	r: number,
	deps: RetrievabilityAggregationDeps,
): void {
	target.total++;
	target.sumR += r;
	if (r > deps.ceiling) {
		target.fresh++;
		return;
	}
	target.pool++;
	if (r >= deps.comfortFloor) target.known++;
	else if (r >= deps.urgentBelow) target.losing++;
	else target.urgent++;
}

/** Combine children into a parent without averaging averages. */
export function mergeRetrievability(
	parts: ReadonlyArray<NoteRetrievability | undefined>,
): NoteRetrievability | undefined {
	const present = parts.filter((part): part is NoteRetrievability => !!part);
	if (present.length === 0) return undefined;

	const merged = emptyRetrievability();
	for (const part of present) {
		merged.urgent += part.urgent;
		merged.losing += part.losing;
		merged.known += part.known;
		merged.fresh += part.fresh;
		merged.pool += part.pool;
		merged.total += part.total;
		merged.sumR += part.sumR;
	}
	return merged;
}

export function aggregateDashboardData(
	deps: AggregationDeps,
): DashboardAggregation {
	const {
		allCards,
		streakCurrent,
		todaySummary,
		newCardsCap,
		reviewsCap,
		archivedSourceUids,
		retrievability,
	} = deps;
	const now = new Date();

	let totalDue = 0;
	let totalNew = 0;
	let totalLearning = 0;
	let totalOverdue = 0;
	let totalCards = 0;
	const orphaned = { total: 0, new: 0, learning: 0, due: 0 };

	const noteMap = new Map<
		string,
		Omit<DashboardNoteEntry, "estimatedMinutes" | "priority">
	>();

	for (const card of allCards) {
		const fsrs = card.fsrs;
		if (archivedSourceUids?.has(card.sourceUid ?? "")) continue;
		if (
			fsrs.suspended ||
			(fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
		)
			continue;

		totalCards++;

		const noteName = card.sourceNoteName;

		switch (fsrs.state) {
			case State.New:
				totalNew++;
				break;
			case State.Learning:
			case State.Relearning:
				totalLearning++;
				break;
			case State.Review:
				if (new Date(fsrs.due) <= now) totalDue++;
				break;
		}

		if (!noteName) {
			orphaned.total++;
			switch (fsrs.state) {
				case State.New:
					orphaned.new++;
					break;
				case State.Learning:
				case State.Relearning:
					orphaned.learning++;
					break;
				case State.Review:
					if (new Date(fsrs.due) <= now) orphaned.due++;
					break;
			}
			continue;
		}

		let entry = noteMap.get(noteName);
		if (!entry) {
			entry = {
				name: noteName,
				path: card.sourceNotePath ?? null,
				due: 0,
				newCount: 0,
				learning: 0,
				total: 0,
				lastReview: null,
				overdueDays: 0,
				overdueCount: 0,
				projects: [],
				retrievability: retrievability ? emptyRetrievability() : undefined,
			};
			noteMap.set(noteName, entry);
		}
		entry.total++;

		switch (fsrs.state) {
			case State.New:
				entry.newCount++;
				break;
			case State.Learning:
			case State.Relearning:
				entry.learning++;
				break;
			case State.Review: {
				if (retrievability && entry.retrievability) {
					tallyRetrievability(
						entry.retrievability,
						retrievability.getRetrievability(card),
						retrievability,
					);
				}
				const dueDate = new Date(fsrs.due);
				if (dueDate <= now) {
					entry.due++;
					const daysOverdue = Math.floor(
						(now.getTime() - dueDate.getTime()) / MS_PER_DAY,
					);
					if (daysOverdue > 0) {
						entry.overdueCount++;
						entry.overdueDays = Math.max(entry.overdueDays, daysOverdue);
					}
					totalOverdue += daysOverdue > 0 ? 1 : 0;
				}
				break;
			}
		}

		if (
			fsrs.lastReview &&
			(!entry.lastReview || fsrs.lastReview > entry.lastReview)
		) {
			entry.lastReview = fsrs.lastReview;
		}
	}

	const notes: DashboardNoteEntry[] = Array.from(noteMap.values()).map(
		(partial) => {
			// In R-Mode the pool is the reviewable work; the due count is not.
			const estimatedMinutes = estimateStudyMinutes(
				partial.retrievability?.pool ?? partial.due,
				partial.newCount,
				partial.learning,
			);
			const priority = computePriority(partial);
			return { ...partial, estimatedMinutes, priority, projects: [] };
		},
	);

	const totalPool = retrievability
		? notes.reduce((sum, note) => sum + (note.retrievability?.pool ?? 0), 0)
		: undefined;

	const estimatedTotalMinutes = estimateStudyMinutes(
		totalPool ?? totalDue,
		totalNew,
		totalLearning,
	);

	return {
		notes,
		totalDue,
		totalPool,
		totalNew,
		totalLearning,
		totalOverdue,
		totalCards,
		streak: streakCurrent,
		estimatedTotalMinutes,
		noteCount: noteMap.size,
		todayProgress: {
			studied: todaySummary.studied,
			minutes: todaySummary.minutes,
			newCards: todaySummary.newCards,
			newCardsCap: newCardsCap,
			reviewCards: todaySummary.reviewCards,
			reviewsCap: reviewsCap,
		},
		orphanedCards: orphaned,
	};
}
