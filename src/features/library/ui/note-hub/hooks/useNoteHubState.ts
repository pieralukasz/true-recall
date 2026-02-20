import type {
	NoteHubApi,
	NoteHubSortBy,
	NoteHubSortDirection,
	NoteHubStatusFilter,
	SelectionMode,
} from "@shared/store";
import type { ProjectInfo, ProjectNoteInfo } from "@shared/types";
import { usePlugin } from "@shared/ui/preact";
import { useEffect, useState } from "preact/hooks";

export function useNoteHub(): NoteHubApi {
	const store = usePlugin().store;
	if (!store) throw new Error("Store not initialized");
	return store.getState().noteHub;
}

export function useNoteHubState() {
	const plugin = usePlugin();
	const [state, setState] = useState(() => {
		const nh = plugin.store?.getState().noteHub;
		if (!nh) {
			return {
				isLoading: true,
				projects: [] as ProjectInfo[],
				unassignedNotes: [] as ProjectNoteInfo[],
				searchQuery: "",
				expandedProjectIds: new Set<string>(),
				selectionMode: "idle" as SelectionMode,
				selectedNotePaths: new Set<string>(),
				statusFilter: "all" as NoteHubStatusFilter,
				sortBy: "name" as NoteHubSortBy,
				sortDirection: "asc" as NoteHubSortDirection,
				filteredProjects: [] as ProjectInfo[],
				filteredUnassigned: [] as ProjectNoteInfo[],
			};
		}
		return {
			isLoading: nh.isLoading,
			projects: nh.projects,
			unassignedNotes: nh.unassignedNotes,
			searchQuery: nh.searchQuery,
			expandedProjectIds: nh.expandedProjectIds,
			selectionMode: nh.selectionMode as SelectionMode,
			selectedNotePaths: nh.selectedNotePaths,
			statusFilter: nh.statusFilter as NoteHubStatusFilter,
			sortBy: nh.sortBy as NoteHubSortBy,
			sortDirection: nh.sortDirection as NoteHubSortDirection,
			filteredProjects: nh.getFilteredProjects(),
			filteredUnassigned: nh.getFilteredUnassignedNotes(),
		};
	});

	useEffect(() => {
		if (!plugin.store) return;
		const unsub = plugin.store.subscribe(
			(s) => s.noteHub,
			() => {
				const nh = plugin.store?.getState().noteHub;
				if (!nh) return;
				setState({
					isLoading: nh.isLoading,
					projects: nh.projects,
					unassignedNotes: nh.unassignedNotes,
					searchQuery: nh.searchQuery,
					expandedProjectIds: nh.expandedProjectIds,
					selectionMode: nh.selectionMode as SelectionMode,
					selectedNotePaths: nh.selectedNotePaths,
					statusFilter: nh.statusFilter as NoteHubStatusFilter,
					sortBy: nh.sortBy as NoteHubSortBy,
					sortDirection: nh.sortDirection as NoteHubSortDirection,
					filteredProjects: nh.getFilteredProjects(),
					filteredUnassigned: nh.getFilteredUnassignedNotes(),
				});
			},
		);
		return unsub;
	}, [plugin]);

	return state;
}
