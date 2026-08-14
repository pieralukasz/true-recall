import type {
	DashboardNoteEntry,
	NotePriority,
	NoteRetrievability,
} from "@true-recall/core/types/dashboard.types";

export const PRIORITY_DOT: Record<NotePriority, string> = {
	overdue: "ep:bg-obs-red",
	hot: "ep:bg-obs-orange",
	due: "ep:bg-obs-blue",
	light: "ep:bg-obs-green",
	done: "ep:bg-obs-faint",
};

const PRIORITY_ORDER: Record<NotePriority, number> = {
	overdue: 0,
	hot: 1,
	due: 2,
	light: 3,
	done: 4,
};

/**
 * Breakdown exposed by the compact memory bar. Returns null when there is
 * nothing to explain, avoiding a tooltip made entirely of zeroes.
 */
export function describeRetrievability(
	spread: NoteRetrievability | undefined,
): string | null {
	if (!spread || spread.total === 0) return null;

	// The pool reads as a debt unless the part that is actually below target is
	// named next to it — most of it is usually cards a session may draw from,
	// not work that is owed.
	return [
		`${spread.urgent} at risk · ${spread.losing} slipping`,
		`${spread.known} known · ${spread.fresh} fresh`,
		`${spread.urgent + spread.losing} below target · ${spread.pool} can be drawn`,
		`Mean retrievability ${Math.round((spread.sumR / spread.total) * 100)}%`,
	].join("\n");
}

export function computePriority(note: {
	overdueCount: number;
	due: number;
	learning: number;
	newCount: number;
	retrievability?: NoteRetrievability;
}): NotePriority {
	// R-Mode has no lateness, so priority follows how much is being lost rather
	// than how long something has sat past a date.
	if (note.retrievability) {
		const { urgent, losing, known } = note.retrievability;
		if (urgent > 0) return "overdue";
		if (losing + note.learning >= 10) return "hot";
		if (losing + note.learning > 0) return "due";
		if (known > 0 || note.newCount > 0) return "light";
		return "done";
	}

	if (note.overdueCount > 0) return "overdue";
	if (note.due + note.learning >= 10) return "hot";
	if (note.due + note.learning > 0) return "due";
	if (note.newCount > 0) return "light";
	return "done";
}

export function prioritySortComparator(
	a: DashboardNoteEntry,
	b: DashboardNoteEntry,
): number {
	const pa = PRIORITY_ORDER[a.priority];
	const pb = PRIORITY_ORDER[b.priority];
	if (pa !== pb) return pa - pb;

	// In R-Mode the drawable pool is what "active" means; due counts are noise.
	const aActive = (a.retrievability?.pool ?? a.due) + a.learning + a.newCount;
	const bActive = (b.retrievability?.pool ?? b.due) + b.learning + b.newCount;
	if (aActive !== bActive) return bActive - aActive;

	return a.name.localeCompare(b.name);
}
