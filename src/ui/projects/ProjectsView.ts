/**
 * Projects View
 * Panel-based view for managing projects
 */
import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import { VIEW_TYPE_PROJECTS, VIEW_TYPE_REVIEW } from "../../constants";
import { createProjectsStateManager } from "../../state/projects.state";
import { Panel } from "../components/Panel";
import { ProjectsContent } from "./ProjectsContent";
import { SelectNoteModal, AddNotesToProjectModal } from "../modals";
import type EpistemePlugin from "../../main";
import type { ProjectInfo, SourceNoteInfo } from "../../types";
import type { CardStore } from "../../types/fsrs/store.types";

/**
 * Projects View
 * Panel for managing projects (CRUD, review)
 */
export class ProjectsView extends ItemView {
	private plugin: EpistemePlugin;
	private stateManager = createProjectsStateManager();

	// UI Components
	private panelComponent: Panel | null = null;
	private contentComponent: ProjectsContent | null = null;

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

		// Create Panel component (shared with Ready to Harvest)
		this.panelComponent = new Panel(container, {
			title: "Projects",
			onRefresh: () => void this.loadProjects(),
		});
		this.panelComponent.render();

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() => this.renderContent());

		// Initial render
		this.renderContent();

		// Load projects
		void this.loadProjects();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.panelComponent?.destroy();
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
	 * Handle deleting a project
	 * Updates frontmatter in all associated notes before removing the project
	 */
	private async handleDeleteProject(projectId: number): Promise<void> {
		const state = this.stateManager.getState();
		const project = state.projects.find(p => p.id === projectId);
		if (!project) return;

		// Confirm deletion
		const confirmMessage = project.noteCount > 0
			? `Delete project "${project.name}"? This will remove it from ${project.noteCount} note(s).`
			: `Delete project "${project.name}"?`;

		if (!confirm(confirmMessage)) {
			return;
		}

		try {
			// Get all source_uids in this project BEFORE deleting
			const sqlStore = this.plugin.cardStore as CardStore & {
				getNotesInProject?: (projectId: number) => string[];
				getAllSourceNotes?: () => SourceNoteInfo[];
				getProjectNamesForNote?: (sourceUid: string) => string[];
				deleteProject?: (id: number) => void;
			};

			const sourceUids = sqlStore.getNotesInProject?.(projectId) ?? [];

			// Update frontmatter for each affected note
			if (sourceUids.length > 0) {
				const frontmatterService = this.plugin.flashcardManager.getFrontmatterService();
				const sourceNotes = sqlStore.getAllSourceNotes?.() ?? [];

				// Build UID -> path map
				const uidToPath = new Map<string, string>();
				for (const note of sourceNotes) {
					if (note.notePath) {
						uidToPath.set(note.uid, note.notePath);
					}
				}

				for (const uid of sourceUids) {
					const filePath = uidToPath.get(uid);
					if (!filePath) continue;

					const file = this.app.vault.getAbstractFileByPath(filePath);
					if (!(file instanceof TFile)) continue;

					// Get current projects for this note
					const currentProjects = sqlStore.getProjectNamesForNote?.(uid) ?? [];

					// Remove the deleted project
					const updatedProjects = currentProjects.filter(p => p !== project.name);

					// Update frontmatter
					await frontmatterService.setProjectsInFrontmatter(file, updatedProjects);
				}
			}

			// Now delete from database
			sqlStore.deleteProject?.(projectId);
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
	 * Handle creating a project from a selected note
	 */
	private async handleCreateFromNote(): Promise<void> {
		const modal = new SelectNoteModal(this.app, {
			title: "Create Project from Note",
			excludeFlashcardFiles: true,
		});
		const result = await modal.openAndWait();
		if (result.cancelled || !result.selectedNote) return;

		const note = result.selectedNote;
		const projectName = note.basename;

		// Check if project already exists
		const state = this.stateManager.getState();
		if (state.projects.some(p => p.name.toLowerCase() === projectName.toLowerCase())) {
			new Notice(`Project "${projectName}" already exists`);
			return;
		}

		// Create project and add note to it
		await this.createProjectFromNote(note, projectName);
	}

	/**
	 * Create a project from a note and add that note to the project
	 */
	private async createProjectFromNote(note: TFile, projectName: string): Promise<void> {
		try {
			// Create the project
			const projectId = this.plugin.cardStore.createProject?.(projectName);
			if (!projectId || projectId < 0) {
				new Notice("Failed to create project");
				return;
			}

			// Get or create source note UID
			const frontmatterService = this.plugin.flashcardManager.getFrontmatterService();
			let sourceUid = await frontmatterService.getSourceNoteUid(note);
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(note, sourceUid);
			}

			// Add note to project (update frontmatter)
			await frontmatterService.setProjectsInFrontmatter(note, [projectName]);

			// Sync to database
			const sqlStore = this.plugin.cardStore as CardStore & {
				syncNoteProjects?: (sourceUid: string, projectNames: string[]) => void;
				upsertSourceNote?: (info: SourceNoteInfo) => void;
			};

			// Ensure source note exists in DB
			sqlStore.upsertSourceNote?.({
				uid: sourceUid,
				noteName: note.basename,
				notePath: note.path,
			});

			// Sync projects
			sqlStore.syncNoteProjects?.(sourceUid, [projectName]);

			// Refresh projects list
			await this.loadProjects();

			new Notice(`Project "${projectName}" created from note`);
		} catch (error) {
			console.error("[ProjectsView] Error creating project from note:", error);
			new Notice("Failed to create project from note");
		}
	}

	/**
	 * Handle adding orphaned notes to a project
	 */
	private async handleAddNotesToProject(projectId: number, projectName: string): Promise<void> {
		const sqlStore = this.plugin.cardStore as CardStore & {
			getOrphanedSourceNotes?: () => { uid: string; noteName: string; notePath: string }[];
			syncNoteProjects?: (sourceUid: string, projectNames: string[]) => void;
			getProjectNamesForNote?: (sourceUid: string) => string[];
		};

		// Get orphaned notes
		const orphanedNotes = sqlStore.getOrphanedSourceNotes?.() ?? [];

		if (orphanedNotes.length === 0) {
			new Notice("No notes without projects found");
			return;
		}

		const modal = new AddNotesToProjectModal(this.app, {
			projectName,
			orphanedNotes,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.selectedNotes.length === 0) return;

		// Add selected notes to project
		await this.addNotesToProject(result.selectedNotes, projectId, projectName);
	}

	/**
	 * Add notes to a project (update frontmatter and DB)
	 */
	private async addNotesToProject(
		notes: { uid: string; noteName: string; notePath: string }[],
		projectId: number,
		projectName: string
	): Promise<void> {
		const frontmatterService = this.plugin.flashcardManager.getFrontmatterService();
		const sqlStore = this.plugin.cardStore as CardStore & {
			syncNoteProjects?: (sourceUid: string, projectNames: string[]) => void;
			getProjectNamesForNote?: (sourceUid: string) => string[];
		};

		let added = 0;

		for (const noteInfo of notes) {
			const file = this.app.vault.getAbstractFileByPath(noteInfo.notePath);
			if (!(file instanceof TFile)) continue;

			try {
				// Get current projects for this note
				const currentProjects = sqlStore.getProjectNamesForNote?.(noteInfo.uid) ?? [];
				const newProjects = [...currentProjects, projectName];

				// Update frontmatter
				await frontmatterService.setProjectsInFrontmatter(file, newProjects);

				// Sync to database
				sqlStore.syncNoteProjects?.(noteInfo.uid, newProjects);
				added++;
			} catch (error) {
				console.error(`[ProjectsView] Error adding note ${noteInfo.noteName} to project:`, error);
			}
		}

		if (added > 0) {
			new Notice(`Added ${added} note(s) to "${projectName}"`);
			await this.loadProjects();
		} else {
			new Notice("No notes were added");
		}
	}

	/**
	 * Render content (Panel is created once in onOpen)
	 */
	private renderContent(): void {
		if (!this.panelComponent) return;

		const state = this.stateManager.getState();
		const projectsWithCards = this.stateManager.getProjectsWithCards();
		const emptyProjects = this.stateManager.getEmptyProjects();

		const contentContainer = this.panelComponent.getContentContainer();

		// Render Content (includes toolbar with search + new button)
		this.contentComponent?.destroy();
		contentContainer.empty();
		this.contentComponent = new ProjectsContent(contentContainer, {
			isLoading: state.isLoading,
			projectsWithCards,
			emptyProjects,
			searchQuery: state.searchQuery,
			app: this.app,
			component: this,
			onSearchChange: (query) => this.stateManager.setSearchQuery(query),
			onStartReview: (name) => void this.handleStartReview(name),
			onDelete: (id) => void this.handleDeleteProject(id),
			onAddNotes: (id, name) => void this.handleAddNotesToProject(id, name),
			onCreateFromNote: () => void this.handleCreateFromNote(),
		});
		this.contentComponent.render();
	}
}
