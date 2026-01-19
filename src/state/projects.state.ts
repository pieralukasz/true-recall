/**
 * Projects State Manager
 * Centralized state management for the projects view
 */
import type { ProjectInfo } from "../types";

/**
 * Complete state of the projects view
 */
export interface ProjectsState {
	/** Loading state */
	isLoading: boolean;
	/** All projects */
	projects: ProjectInfo[];
	/** Search query for filtering */
	searchQuery: string;
	/** Project ID being edited (null if none) */
	editingProjectId: number | null;
}

/**
 * Listener callback type for projects state changes
 */
export type ProjectsStateListener = (state: ProjectsState, prevState: ProjectsState) => void;

/**
 * Partial state update type for projects
 */
export type PartialProjectsState = Partial<ProjectsState>;

/**
 * Creates the initial projects state
 */
function createInitialState(): ProjectsState {
	return {
		isLoading: true,
		projects: [],
		searchQuery: "",
		editingProjectId: null,
	};
}

/**
 * Centralized state manager for the projects view
 */
export class ProjectsStateManager {
	private state: ProjectsState;
	private listeners: Set<ProjectsStateListener> = new Set();

	constructor() {
		this.state = createInitialState();
	}

	/**
	 * Get current state (immutable copy)
	 */
	getState(): ProjectsState {
		return {
			...this.state,
			projects: [...this.state.projects],
		};
	}

	/**
	 * Update state with partial updates
	 */
	setState(partial: PartialProjectsState): void {
		const prevState = this.state;
		this.state = {
			...this.state,
			...partial,
		};
		this.notifyListeners(prevState);
	}

	/**
	 * Subscribe to state changes
	 */
	subscribe(listener: ProjectsStateListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Reset state to initial values
	 */
	reset(): void {
		const prevState = this.state;
		this.state = createInitialState();
		this.notifyListeners(prevState);
	}

	// ===== Convenience Methods =====

	/**
	 * Set loading state
	 */
	setLoading(isLoading: boolean): void {
		this.setState({ isLoading });
	}

	/**
	 * Set all projects
	 */
	setProjects(projects: ProjectInfo[]): void {
		this.setState({
			projects,
			isLoading: false,
		});
	}

	/**
	 * Set search query
	 */
	setSearchQuery(query: string): void {
		this.setState({ searchQuery: query });
	}

	/**
	 * Set editing project ID
	 */
	setEditingProject(id: number | null): void {
		this.setState({ editingProjectId: id });
	}

	/**
	 * Update a project in the list
	 */
	updateProject(projectId: number, updates: Partial<ProjectInfo>): void {
		const projects = this.state.projects.map(p =>
			p.id === projectId ? { ...p, ...updates } : p
		);
		this.setState({ projects });
	}

	/**
	 * Remove a project from the list
	 */
	removeProject(projectId: number): void {
		const projects = this.state.projects.filter(p => p.id !== projectId);
		this.setState({ projects });
	}

	/**
	 * Add a new project to the list
	 */
	addProject(project: ProjectInfo): void {
		this.setState({
			projects: [...this.state.projects, project],
		});
	}

	/**
	 * Get filtered projects based on current state
	 */
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

	/**
	 * Get projects with cards
	 */
	getProjectsWithCards(): ProjectInfo[] {
		return this.getFilteredProjects().filter(p => p.cardCount > 0);
	}

	/**
	 * Get empty projects
	 */
	getEmptyProjects(): ProjectInfo[] {
		return this.getFilteredProjects().filter(p => p.cardCount === 0);
	}

	/**
	 * Get total stats
	 */
	getTotalStats(): { projectCount: number; totalCards: number; totalDue: number } {
		const projects = this.state.projects;
		return {
			projectCount: projects.length,
			totalCards: projects.reduce((sum, p) => sum + p.cardCount, 0),
			totalDue: projects.reduce((sum, p) => sum + p.dueCount, 0),
		};
	}

	// ===== Private Methods =====

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

/**
 * Create a new ProjectsStateManager instance
 */
export function createProjectsStateManager(): ProjectsStateManager {
	return new ProjectsStateManager();
}
