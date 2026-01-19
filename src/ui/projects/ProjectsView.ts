/**
 * Projects View
 * Panel-based view for managing projects
 */
import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { VIEW_TYPE_PROJECTS, VIEW_TYPE_REVIEW } from "../../constants";
import { createProjectsStateManager } from "../../state/projects.state";
import { ProjectsHeader } from "./ProjectsHeader";
import { ProjectsContent } from "./ProjectsContent";
import type EpistemePlugin from "../../main";
import type { ProjectInfo } from "../../types";

/**
 * Projects View
 * Panel for managing projects (CRUD, review)
 */
export class ProjectsView extends ItemView {
	private plugin: EpistemePlugin;
	private stateManager = createProjectsStateManager();

	// UI Components
	private headerComponent: ProjectsHeader | null = null;
	private contentComponent: ProjectsContent | null = null;

	// Container elements
	private headerContainer!: HTMLElement;
	private contentContainer!: HTMLElement;

	// State subscription
	private unsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_PROJECTS;
	}

	getDisplayText(): string {
		return "Projects";
	}

	getIcon(): string {
		return "folder";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass("episteme-panel-view");

		// Create container elements
		this.headerContainer = container.createDiv({
			cls: "episteme-panel-header-container",
		});
		this.contentContainer = container.createDiv({
			cls: "episteme-panel-content-container",
		});

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() => this.render());

		// Initial render
		this.render();

		// Load projects
		void this.loadProjects();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.headerComponent?.destroy();
		this.contentComponent?.destroy();
	}

	/**
	 * Load projects from store
	 */
	private async loadProjects(): Promise<void> {
		this.stateManager.setLoading(true);

		try {
			const projects = this.plugin.cardStore.getProjectStats?.() ?? [];
			this.stateManager.setProjects(projects);
		} catch (error) {
			console.error("[ProjectsView] Error loading projects:", error);
			new Notice("Failed to load projects");
			this.stateManager.setLoading(false);
		}
	}

	/**
	 * Handle creating a new project
	 */
	private async handleCreateProject(name: string): Promise<void> {
		const trimmedName = name.trim();
		if (!trimmedName) {
			new Notice("Project name cannot be empty");
			return;
		}

		// Check for duplicate
		const state = this.stateManager.getState();
		if (state.projects.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
			new Notice("A project with this name already exists");
			return;
		}

		try {
			const projectId = this.plugin.cardStore.createProject?.(trimmedName) ?? -1;
			const newProject: ProjectInfo = {
				id: projectId,
				name: trimmedName,
				cardCount: 0,
				dueCount: 0,
				newCount: 0,
			};
			this.stateManager.addProject(newProject);
			new Notice(`Project "${trimmedName}" created`);
		} catch (error) {
			console.error("[ProjectsView] Error creating project:", error);
			new Notice("Failed to create project");
		}
	}

	/**
	 * Handle renaming a project
	 */
	private async handleRenameProject(projectId: number, newName: string): Promise<void> {
		const trimmedName = newName.trim();
		if (!trimmedName) {
			new Notice("Project name cannot be empty");
			this.stateManager.setEditingProject(null);
			return;
		}

		// Check for duplicate
		const state = this.stateManager.getState();
		const otherProjects = state.projects.filter(p => p.id !== projectId);
		if (otherProjects.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
			new Notice("A project with this name already exists");
			this.stateManager.setEditingProject(null);
			return;
		}

		try {
			this.plugin.cardStore.renameProject?.(projectId, trimmedName);
			this.stateManager.updateProject(projectId, { name: trimmedName });
			this.stateManager.setEditingProject(null);
			new Notice(`Project renamed to "${trimmedName}"`);
		} catch (error) {
			console.error("[ProjectsView] Error renaming project:", error);
			new Notice("Failed to rename project");
			this.stateManager.setEditingProject(null);
		}
	}

	/**
	 * Handle deleting a project
	 */
	private async handleDeleteProject(projectId: number): Promise<void> {
		const state = this.stateManager.getState();
		const project = state.projects.find(p => p.id === projectId);
		if (!project) return;

		// Confirm deletion
		const confirmMessage = project.cardCount > 0
			? `Delete project "${project.name}"? The ${project.cardCount} cards will remain but won't be assigned to this project.`
			: `Delete project "${project.name}"?`;

		if (!confirm(confirmMessage)) {
			return;
		}

		try {
			this.plugin.cardStore.deleteProject?.(projectId);
			this.stateManager.removeProject(projectId);
			new Notice(`Project "${project.name}" deleted`);
		} catch (error) {
			console.error("[ProjectsView] Error deleting project:", error);
			new Notice("Failed to delete project");
		}
	}

	/**
	 * Handle starting a review session for a project
	 */
	private async handleStartReview(projectName: string): Promise<void> {
		// Open review view with project filter
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_REVIEW);
		let leaf: WorkspaceLeaf;

		if (leaves.length > 0) {
			leaf = leaves[0]!;
		} else {
			leaf = this.app.workspace.getLeaf("tab");
		}

		await leaf.setViewState({
			type: VIEW_TYPE_REVIEW,
			active: true,
			state: {
				projectFilters: [projectName],
			},
		});

		this.app.workspace.revealLeaf(leaf);
	}

	/**
	 * Render all components
	 */
	private render(): void {
		const state = this.stateManager.getState();
		const stats = this.stateManager.getTotalStats();
		const projectsWithCards = this.stateManager.getProjectsWithCards();
		const emptyProjects = this.stateManager.getEmptyProjects();

		// Render Header
		this.headerComponent?.destroy();
		this.headerContainer.empty();
		this.headerComponent = new ProjectsHeader(this.headerContainer, {
			projectCount: stats.projectCount,
			totalCards: stats.totalCards,
			totalDue: stats.totalDue,
			isLoading: state.isLoading,
			onNewProject: () => this.stateManager.setShowNewProjectInput(true),
			onRefresh: () => void this.loadProjects(),
		});
		this.headerComponent.render();

		// Render Content
		this.contentComponent?.destroy();
		this.contentContainer.empty();
		this.contentComponent = new ProjectsContent(this.contentContainer, {
			isLoading: state.isLoading,
			projectsWithCards,
			emptyProjects,
			searchQuery: state.searchQuery,
			editingProjectId: state.editingProjectId,
			showNewProjectInput: state.showNewProjectInput,
			onSearchChange: (query) => this.stateManager.setSearchQuery(query),
			onStartReview: (name) => void this.handleStartReview(name),
			onEdit: (id) => this.stateManager.setEditingProject(id),
			onDelete: (id) => void this.handleDeleteProject(id),
			onSaveName: (id, name) => void this.handleRenameProject(id, name),
			onCancelEdit: () => this.stateManager.setEditingProject(null),
			onCreateProject: (name) => void this.handleCreateProject(name),
			onCancelCreate: () => this.stateManager.setShowNewProjectInput(false),
		});
		this.contentComponent.render();
	}
}
