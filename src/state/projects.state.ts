import type { ProjectInfo, ProjectNoteInfo } from "../types";

export interface ProjectsState {
	isLoading: boolean;
	projects: ProjectInfo[];
	searchQuery: string;
	editingProjectId: number | null;
	expandedProjectIds: Set<string>;
	selectionMode: "normal" | "selecting";
	selectedNotePaths: Set<string>;
	unassignedNotes: ProjectNoteInfo[];
	isUnassignedExpanded: boolean;
}

export type ProjectsStateListener = (state: ProjectsState, prevState: ProjectsState) => void;

export type PartialProjectsState = Partial<ProjectsState>;

function createInitialState(): ProjectsState {
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
	};
}

export class ProjectsStateManager {
	private state: ProjectsState;
	private listeners: Set<ProjectsStateListener> = new Set();

	constructor() {
		this.state = createInitialState();
	}

	getState(): ProjectsState {
		return {
			...this.state,
			projects: [...this.state.projects],
			expandedProjectIds: new Set(this.state.expandedProjectIds),
			selectedNotePaths: new Set(this.state.selectedNotePaths),
			unassignedNotes: [...this.state.unassignedNotes],
		};
	}

	setState(partial: PartialProjectsState): void {
		const prevState = this.state;
		this.state = {
			...this.state,
			...partial,
		};
		this.notifyListeners(prevState);
	}

	subscribe(listener: ProjectsStateListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	reset(): void {
		const prevState = this.state;
		this.state = createInitialState();
		this.notifyListeners(prevState);
	}

	setLoading(isLoading: boolean): void {
		this.setState({ isLoading });
	}

	setProjects(projects: ProjectInfo[]): void {
		this.setState({
			projects,
			isLoading: false,
		});
	}

	setUnassignedNotes(unassignedNotes: ProjectNoteInfo[]): void {
		this.setState({ unassignedNotes });
	}

	toggleUnassignedExpanded(): void {
		this.setState({ isUnassignedExpanded: !this.state.isUnassignedExpanded });
	}

	setSearchQuery(query: string): void {
		this.setState({ searchQuery: query });
	}

	setEditingProject(id: number | null): void {
		this.setState({ editingProjectId: id });
	}

	toggleProjectExpanded(projectId: string): void {
		const newSet = new Set(this.state.expandedProjectIds);
		if (newSet.has(projectId)) {
			newSet.delete(projectId);
		} else {
			newSet.add(projectId);
		}
		this.setState({ expandedProjectIds: newSet });
	}

	isProjectExpanded(projectId: string): boolean {
		return this.state.expandedProjectIds.has(projectId);
	}

	enterSelectionMode(initialNotePath?: string): void {
		const selectedNotePaths = new Set<string>();
		if (initialNotePath) {
			selectedNotePaths.add(initialNotePath);
		}
		this.setState({
			selectionMode: "selecting",
			selectedNotePaths,
		});
	}

	exitSelectionMode(): void {
		this.setState({
			selectionMode: "normal",
			selectedNotePaths: new Set<string>(),
		});
	}

	toggleNoteSelection(notePath: string): void {
		const newSet = new Set(this.state.selectedNotePaths);
		if (newSet.has(notePath)) {
			newSet.delete(notePath);
		} else {
			newSet.add(notePath);
		}
		this.setState({ selectedNotePaths: newSet });
	}

	isInSelectionMode(): boolean {
		return this.state.selectionMode === "selecting";
	}

	getSelectedNotePaths(): string[] {
		return Array.from(this.state.selectedNotePaths);
	}

	updateProject(projectId: string, updates: Partial<ProjectInfo>): void {
		const projects = this.state.projects.map(p =>
			p.id === projectId ? { ...p, ...updates } : p
		);
		this.setState({ projects });
	}

	removeProject(projectId: string): void {
		const projects = this.state.projects.filter(p => p.id !== projectId);
		this.setState({ projects });
	}

	addProject(project: ProjectInfo): void {
		this.setState({
			projects: [...this.state.projects, project],
		});
	}

	getFilteredProjects(): ProjectInfo[] {
		let projects = [...this.state.projects];

		// Apply search filter
		if (this.state.searchQuery) {
			const query = this.state.searchQuery.toLowerCase();
			projects = projects.filter(
				(project) => project.name.toLowerCase().includes(query)
			);
		}

		// Sort: projects with cards first, then alphabetically
		projects.sort((a, b) => {
			if (a.cardCount > 0 && b.cardCount === 0) return -1;
			if (a.cardCount === 0 && b.cardCount > 0) return 1;
			return a.name.localeCompare(b.name);
		});

		return projects;
	}

	getProjectsWithCards(): ProjectInfo[] {
		return this.getFilteredProjects().filter(p => p.cardCount > 0);
	}

	getEmptyProjects(): ProjectInfo[] {
		return this.getFilteredProjects().filter(p => p.cardCount === 0);
	}

	getTotalStats(): { projectCount: number; totalCards: number; totalDue: number } {
		const projects = this.state.projects;
		return {
			projectCount: projects.length,
			totalCards: projects.reduce((sum, p) => sum + p.cardCount, 0),
			totalDue: projects.reduce((sum, p) => sum + p.dueCount, 0),
		};
	}

	private notifyListeners(prevState: ProjectsState): void {
		const currentState = this.state;
		this.listeners.forEach((listener) => {
			try {
				listener(currentState, prevState);
			} catch (error) {
				console.error("Error in projects state listener:", error);
			}
		});
	}
}

export function createProjectsStateManager(): ProjectsStateManager {
	return new ProjectsStateManager();
}
