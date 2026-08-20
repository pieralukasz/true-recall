import { useSignal } from "@preact/signals";
import { useCallback, useEffect, useMemo } from "preact/hooks";

import { prioritySortComparator } from "@true-recall/core/helpers/note-priority";

import type {
	DashboardNoteEntry,
	NoteFilterMode,
	ProjectFilter,
} from "../types";

const FILTER_PREDICATES: Record<
	Exclude<NoteFilterMode, "all">,
	(n: DashboardNoteEntry) => boolean
> = {
	due: (n) => n.due > 0,
	new: (n) => n.newCount > 0,
	learning: (n) => n.learning > 0,
	overdue: (n) => n.overdueCount > 0,
	pool: (n) => (n.retrievability?.pool ?? 0) > 0,
};

export function useNoteFiltering({
	notes,
	searchQuery,
	rModeEnabled,
}: {
	notes: DashboardNoteEntry[];
	searchQuery: string;
	rModeEnabled: boolean;
}) {
	const activeFilter = useSignal<NoteFilterMode>("all");
	const projectFilter = useSignal<ProjectFilter>({ type: "none" });

	useEffect(() => {
		const invalidForMode = rModeEnabled
			? activeFilter.value === "due" || activeFilter.value === "overdue"
			: activeFilter.value === "pool";
		if (invalidForMode) activeFilter.value = "all";
	}, [rModeEnabled, activeFilter]);

	const unassignedCount = useMemo(
		() => notes.filter((n) => n.projects.length === 0).length,
		[notes],
	);

	const projectFiltered = useMemo(() => {
		const pf = projectFilter.value;
		if (pf.type === "project")
			return notes.filter((n) => n.projects.includes(pf.name));
		if (pf.type === "unassigned")
			return notes.filter((n) => n.projects.length === 0);
		return notes;
	}, [notes, projectFilter.value]);

	const counts = useMemo(() => {
		const c: Record<NoteFilterMode, number> = {
			all: projectFiltered.length,
			due: 0,
			new: 0,
			learning: 0,
			overdue: 0,
			pool: 0,
		};
		for (const n of projectFiltered) {
			if (n.due > 0) c.due++;
			if (n.newCount > 0) c.new++;
			if (n.learning > 0) c.learning++;
			if (n.overdueCount > 0) c.overdue++;
			if ((n.retrievability?.pool ?? 0) > 0) c.pool++;
		}
		return c;
	}, [projectFiltered]);

	const filteredNotes = useMemo(() => {
		let result = projectFiltered;

		const predicate =
			FILTER_PREDICATES[activeFilter.value as Exclude<NoteFilterMode, "all">];
		if (predicate) {
			result = result.filter(predicate);
		}

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter((n) => n.name.toLowerCase().includes(q));
		}

		return [...result].sort(prioritySortComparator);
	}, [projectFiltered, searchQuery, activeFilter.value]);

	const handleFilterChange = useCallback(
		(f: NoteFilterMode) => {
			activeFilter.value = f;
		},
		[activeFilter],
	);

	const handleProjectFilterChange = useCallback(
		(pf: ProjectFilter) => {
			projectFilter.value = pf;
		},
		[projectFilter],
	);

	return {
		activeFilter,
		projectFilter,
		filteredNotes,
		counts,
		unassignedCount,
		handleFilterChange,
		handleProjectFilterChange,
	};
}
