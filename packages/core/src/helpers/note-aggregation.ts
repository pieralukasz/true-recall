import { State } from "ts-fsrs";

import { MS_PER_DAY } from "@true-recall/core/constants";
import { computePriority } from "@true-recall/core/helpers/note-priority";
import { estimateStudyMinutes } from "@true-recall/core/helpers/time-estimate";
import type { RModeCardScore } from "@true-recall/core/services/review/retrievability-queue";
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
	getScore: (card: CardSchedulingMeta) => RModeCardScore;
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
	now?: Date;
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
	score: RModeCardScore,
	deps: RetrievabilityAggregationDeps,
): void {
	const { r, ceiling, comfortFloor } = score;
	target.total++;
	target.sumR += r;
	if (r > ceiling) {
		target.fresh++;
		return;
	}
	target.pool++;
	if (r >= comfortFloor) target.known++;
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
	const now = deps.now ?? new Date();

	let totalDue = 0;
	let totalNew = 0;
	let totalLearning = 0;
	let totalLearningPending = 0;
	let totalOverdue = 0;
	let totalCards = 0;
	const aggregateRetrievability = retrievability
		? emptyRetrievability()
		: undefined;
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
		const reviewScore =
			fsrs.state === State.Review && retrievability
				? retrievability.getScore(card)
				: undefined;
		if (reviewScore && aggregateRetrievability && retrievability) {
			tallyRetrievability(aggregateRetrievability, reviewScore, retrievability);
		}

		switch (fsrs.state) {
			case State.New:
				totalNew++;
				break;
			case State.Learning:
			case State.Relearning:
				if (new Date(fsrs.due) <= now) totalLearning++;
				else totalLearningPending++;
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
					if (new Date(fsrs.due) <= now) orphaned.learning++;
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
				learningPending: 0,
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
				if (new Date(fsrs.due) <= now) entry.learning++;
				else entry.learningPending = (entry.learningPending ?? 0) + 1;
				break;
			case State.Review: {
				if (retrievability && entry.retrievability && reviewScore) {
					tallyRetrievability(
						entry.retrievability,
						reviewScore,
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

	const totalPool = aggregateRetrievability?.pool;

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
		totalLearningPending,
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
