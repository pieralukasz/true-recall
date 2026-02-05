import type {
	AppState,
	AppStoreDeps,
	ProjectsSliceState,
	ProjectsSliceActions,
} from "../types";
import type { ProjectInfo, ProjectNoteInfo } from "../../../types";

type ProjectsSlice = ProjectsSliceState & ProjectsSliceActions;

function createInitialState(): ProjectsSliceState {
	return {
		isLoading: true,
		projects: [],
		searchQuery: "",
		editingProjectId: null,
		expandedProjectIds: new Set<string>(),
		selectionMode: "normal",
		selectedNotePaths: new Set<string>(),
		unassignedNotes: [],
		isUnassignedExpanded: false,
		showDoneNotes: false,
	};
}

export function createProjectsSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	_deps: AppStoreDeps
): ProjectsSlice {
	const initial = createInitialState();

	const slice: ProjectsSlice = {
		// State
		isLoading: initial.isLoading,
		projects: initial.projects,
		searchQuery: initial.searchQuery,
		editingProjectId: initial.editingProjectId,
		expandedProjectIds: initial.expandedProjectIds,
		selectionMode: initial.selectionMode,
		selectedNotePaths: initial.selectedNotePaths,
		unassignedNotes: initial.unassignedNotes,
		isUnassignedExpanded: initial.isUnassignedExpanded,
		showDoneNotes: initial.showDoneNotes,

		setState: (partial: Partial<ProjectsSliceState>) => {
			set((s) => ({
				projects: { ...s.projects, ...partial },
			}));
		},

		reset: () => {
			const initialState = createInitialState();
			set((s) => ({
				projects: {
					...s.projects,
					isLoading: initialState.isLoading,
					projects: initialState.projects,
					searchQuery: initialState.searchQuery,
					editingProjectId: initialState.editingProjectId,
					expandedProjectIds: initialState.expandedProjectIds,
					selectionMode: initialState.selectionMode,
					selectedNotePaths: initialState.selectedNotePaths,
					unassignedNotes: initialState.unassignedNotes,
					isUnassignedExpanded: initialState.isUnassignedExpanded,
					showDoneNotes: initialState.showDoneNotes,
				},
			}));
		},

		setLoading: (isLoading: boolean) => {
			set((s) => ({
				projects: { ...s.projects, isLoading },
			}));
		},

		setProjects: (projects: ProjectInfo[]) => {
			set((s) => ({
				projects: {
					...s.projects,
					projects,
					isLoading: false,
				},
			}));
		},

		setUnassignedNotes: (unassignedNotes: ProjectNoteInfo[]) => {
			set((s) => ({
				projects: { ...s.projects, unassignedNotes },
			}));
		},

		toggleUnassignedExpanded: () => {
			set((s) => ({
				projects: {
					...s.projects,
					isUnassignedExpanded: !s.projects.isUnassignedExpanded,
				},
			}));
		},

		toggleShowDoneNotes: () => {
			set((s) => ({
				projects: {
					...s.projects,
					showDoneNotes: !s.projects.showDoneNotes,
				},
			}));
		},

		setSearchQuery: (query: string) => {
			set((s) => ({
				projects: { ...s.projects, searchQuery: query },
			}));
		},

		setEditingProject: (id: number | null) => {
			set((s) => ({
				projects: { ...s.projects, editingProjectId: id },
			}));
		},

		toggleProjectExpanded: (projectId: string) => {
			const newSet = new Set(get().projects.expandedProjectIds);
			if (newSet.has(projectId)) {
				newSet.delete(projectId);
			} else {
				newSet.add(projectId);
			}
			set((s) => ({
				projects: { ...s.projects, expandedProjectIds: newSet },
			}));
		},

		isProjectExpanded: (projectId: string) => {
			return get().projects.expandedProjectIds.has(projectId);
		},

		enterSelectionMode: (initialNotePath?: string) => {
			const selectedNotePaths = new Set<string>();
			if (initialNotePath) {
				selectedNotePaths.add(initialNotePath);
			}
			set((s) => ({
				projects: {
					...s.projects,
					selectionMode: "selecting",
					selectedNotePaths,
				},
			}));
		},

		exitSelectionMode: () => {
			set((s) => ({
				projects: {
					...s.projects,
					selectionMode: "normal",
					selectedNotePaths: new Set<string>(),
				},
			}));
		},

		toggleNoteSelection: (notePath: string) => {
			const newSet = new Set(get().projects.selectedNotePaths);
			if (newSet.has(notePath)) {
				newSet.delete(notePath);
			} else {
				newSet.add(notePath);
			}
			set((s) => ({
				projects: { ...s.projects, selectedNotePaths: newSet },
			}));
		},

		isInSelectionMode: () => {
			return get().projects.selectionMode === "selecting";
		},

		getSelectedNotePaths: () => {
			return Array.from(get().projects.selectedNotePaths);
		},

		updateProject: (projectId: string, updates: Partial<ProjectInfo>) => {
			const projects = get().projects.projects.map((p) =>
				p.id === projectId ? { ...p, ...updates } : p
			);
			set((s) => ({
				projects: { ...s.projects, projects },
			}));
		},

		removeProject: (projectId: string) => {
			const projects = get().projects.projects.filter((p) => p.id !== projectId);
			set((s) => ({
				projects: { ...s.projects, projects },
			}));
		},

		addProject: (project: ProjectInfo) => {
			set((s) => ({
				projects: {
					...s.projects,
					projects: [...s.projects.projects, project],
				},
			}));
		},

		getFilteredProjects: () => {
			const state = get().projects;
			let projects = [...state.projects];

			if (state.searchQuery) {
				const query = state.searchQuery.toLowerCase();
				projects = projects.filter((project) =>
					project.name.toLowerCase().includes(query)
				);
			}

			projects.sort((a, b) => {
				if (a.cardCount > 0 && b.cardCount === 0) return -1;
				if (a.cardCount === 0 && b.cardCount > 0) return 1;
				return a.name.localeCompare(b.name);
			});

			return projects;
		},

		getProjectsWithCards: () => {
			return get().projects.getFilteredProjects().filter((p) => p.cardCount > 0);
		},

		getEmptyProjects: () => {
			return get().projects.getFilteredProjects().filter((p) => p.cardCount === 0);
		},

		getTotalStats: () => {
			const projects = get().projects.projects;
			return {
				projectCount: projects.length,
				totalCards: projects.reduce((sum, p) => sum + p.cardCount, 0),
				totalDue: projects.reduce((sum, p) => sum + p.dueCount, 0),
			};
		},
	};

	return slice;
}
