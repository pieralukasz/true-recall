import type {
	AppState,
	AppStoreDeps,
	NoteHubSliceState,
	NoteHubSliceActions,
	NoteHubStatusFilter,
	NoteHubSortBy,
} from "../types";
import type { ProjectInfo, ProjectNoteInfo } from "../../../types";
import { createSelectionActions, toggleSetItem } from "../helpers/slice-helpers";

type NoteHubSlice = NoteHubSliceState & NoteHubSliceActions;

function createInitialState(): NoteHubSliceState {
	return {
		isLoading: true,
		projects: [],
		unassignedNotes: [],
		searchQuery: "",
		expandedProjectIds: new Set<string>(),
		selectionMode: "normal",
		selectedNotePaths: new Set<string>(),
		statusFilter: "all",
		sortBy: "name",
		sortDirection: "asc",
	};
}

function matchesStatusFilter(note: ProjectNoteInfo, filter: NoteHubStatusFilter): boolean {
	switch (filter) {
		case "all":
			return true;
		case "has-due":
			return note.dueCount > 0;
		case "has-new":
			return note.newCount > 0;
		case "needs-cards":
			return note.cardCount === 0;
		case "no-due":
			return note.cardCount > 0 && note.dueCount === 0 && note.newCount === 0 && note.learningCount === 0;
	}
}

function sortNotes(notes: ProjectNoteInfo[], sortBy: NoteHubSortBy, direction: "asc" | "desc"): ProjectNoteInfo[] {
	const modifier = direction === "asc" ? 1 : -1;
	return [...notes].sort((a, b) => {
		switch (sortBy) {
			case "name":
				return modifier * a.name.localeCompare(b.name);
			case "due":
				return modifier * (a.dueCount - b.dueCount);
			case "cards":
				return modifier * (a.cardCount - b.cardCount);
		}
	});
}

export function createNoteHubSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	deps: AppStoreDeps
): NoteHubSlice {
	const initial = createInitialState();

	const slice: NoteHubSlice = {
		...initial,

		setState: (partial: Partial<NoteHubSliceState>) => {
			set((s) => ({
				noteHub: { ...s.noteHub, ...partial },
			}));
		},

		reset: () => {
			set((s) => ({
				noteHub: { ...s.noteHub, ...createInitialState() },
			}));
		},

		setLoading: (isLoading: boolean) => {
			set((s) => ({
				noteHub: { ...s.noteHub, isLoading },
			}));
		},

		setProjects: (projects: ProjectInfo[]) => {
			set((s) => ({
				noteHub: {
					...s.noteHub,
					projects,
					isLoading: false,
				},
			}));
		},

		setUnassignedNotes: (notes: ProjectNoteInfo[]) => {
			set((s) => ({
				noteHub: { ...s.noteHub, unassignedNotes: notes },
			}));
		},

		setSearchQuery: (query: string) => {
			set((s) => ({
				noteHub: { ...s.noteHub, searchQuery: query },
			}));
		},

		toggleProjectExpanded: toggleSetItem(set, get, "noteHub", "expandedProjectIds"),

		isProjectExpanded: (projectId: string) => {
			return get().noteHub.expandedProjectIds.has(projectId);
		},

		...(() => {
			const sel = createSelectionActions(set, get, "noteHub", "selectionMode", "selectedNotePaths");
			return {
				enterSelectionMode: sel.enterSelectionMode,
				exitSelectionMode: sel.exitSelectionMode,
				toggleNoteSelection: sel.toggleSelection,
				isInSelectionMode: sel.isInSelectionMode,
				getSelectedNotePaths: sel.getSelectedIds,
			};
		})(),

		setStatusFilter: (filter: NoteHubStatusFilter) => {
			set((s) => ({
				noteHub: { ...s.noteHub, statusFilter: filter },
			}));
		},

		setSortBy: (sortBy: NoteHubSortBy) => {
			set((s) => ({
				noteHub: { ...s.noteHub, sortBy },
			}));
		},

		toggleSortDirection: () => {
			set((s) => ({
				noteHub: {
					...s.noteHub,
					sortDirection: s.noteHub.sortDirection === "asc" ? "desc" : "asc",
				},
			}));
		},

		getFilteredProjects: () => {
			const state = get().noteHub;
			let projects = state.projects.map((p) => ({ ...p, notes: [...p.notes] }));

			if (state.searchQuery) {
				const query = state.searchQuery.toLowerCase();
				projects = projects
					.map((project) => {
						const nameMatches = project.name.toLowerCase().includes(query);
						const filteredNotes = project.notes.filter((n) =>
							n.name.toLowerCase().includes(query)
						);
						if (nameMatches) return project;
						if (filteredNotes.length > 0) return { ...project, notes: filteredNotes };
						return null;
					})
					.filter((p): p is ProjectInfo => p !== null);
			}

			if (state.statusFilter !== "all") {
				projects = projects
					.map((project) => ({
						...project,
						notes: project.notes.filter((n) => matchesStatusFilter(n, state.statusFilter)),
					}))
					.filter((p) => p.notes.length > 0);
			}

			projects.sort((a, b) => a.name.localeCompare(b.name));

			return projects.map((project) => ({
				...project,
				notes: sortNotes(project.notes, state.sortBy, state.sortDirection),
			}));
		},

		getFilteredUnassignedNotes: () => {
			const state = get().noteHub;
			let notes = [...state.unassignedNotes];

			if (state.searchQuery) {
				const query = state.searchQuery.toLowerCase();
				notes = notes.filter((n) => n.name.toLowerCase().includes(query));
			}

			if (state.statusFilter !== "all") {
				notes = notes.filter((n) => matchesStatusFilter(n, state.statusFilter));
			}

			return sortNotes(notes, state.sortBy, state.sortDirection);
		},
	};

	return slice;
}
