import type {
	AppState,
	AppStoreDeps,
	ProjectsSliceState,
	ProjectsSliceActions,
} from "../types";
import type { ProjectInfo, ProjectNoteInfo } from "../../../types";
import { createSelectionActions, toggleSetItem } from "../helpers/slice-helpers";

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
		...initial,

		setState: (partial: Partial<ProjectsSliceState>) => {
			set((s) => ({
				projects: { ...s.projects, ...partial },
			}));
		},

		reset: () => {
			set((s) => ({
				projects: { ...s.projects, ...createInitialState() },
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

		toggleProjectExpanded: toggleSetItem(set, get, "projects", "expandedProjectIds"),

		isProjectExpanded: (projectId: string) => {
			return get().projects.expandedProjectIds.has(projectId);
		},

		...(() => {
			const sel = createSelectionActions(set, get, "projects", "selectionMode", "selectedNotePaths");
			return {
				enterSelectionMode: sel.enterSelectionMode,
				exitSelectionMode: sel.exitSelectionMode,
				toggleNoteSelection: sel.toggleSelection,
				isInSelectionMode: sel.isInSelectionMode,
				getSelectedNotePaths: sel.getSelectedIds,
			};
		})(),

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
