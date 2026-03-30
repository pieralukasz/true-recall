import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import type { TodaySummary } from "@shared/types/fsrs/stats.types";
import { State } from "ts-fsrs";
import type { DashboardAggregation, DashboardNoteEntry } from "../types";
import { computePriority } from "./note-priority";
import { estimateStudyMinutes } from "./time-estimate";

interface AggregationDeps {
	allCards: FSRSFlashcardItem[];
	streakCurrent: number;
	todaySummary: TodaySummary;
	newCardsCap: number;
	reviewsCap: number;
	archivedSourceUids?: ReadonlySet<string>;
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
				const dueDate = new Date(fsrs.due);
				if (dueDate <= now) {
					entry.due++;
					const daysOverdue = Math.floor(
						(now.getTime() - dueDate.getTime()) / 86_400_000,
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
			const estimatedMinutes = estimateStudyMinutes(
				partial.due,
				partial.newCount,
				partial.learning,
			);
			const priority = computePriority(partial);
			return { ...partial, estimatedMinutes, priority, projects: [] };
		},
	);

	const estimatedTotalMinutes = estimateStudyMinutes(
		totalDue,
		totalNew,
		totalLearning,
	);

	return {
		notes,
		totalDue,
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
