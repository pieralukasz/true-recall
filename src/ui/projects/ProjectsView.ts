/**
 * Projects View
 * Panel-based view for managing projects
 *
 * v15: Projects are read from frontmatter (source of truth)
 * Project stats are calculated by scanning vault
 */
import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import { State } from "ts-fsrs";
import { VIEW_TYPE_PROJECTS, VIEW_TYPE_REVIEW } from "../../constants";
import { createProjectsStateManager } from "../../state/projects.state";
import { Panel } from "../components/Panel";
import { ProjectsContent } from "./ProjectsContent";
import { SelectNoteModal } from "../modals";
import type EpistemePlugin from "../../main";

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

	// Native header action elements
	private refreshAction: HTMLElement | null = null;

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

		// Create Panel component (header is native Obsidian header)
		this.panelComponent = new Panel(container);
		this.panelComponent.render();

		// Add native refresh action
		this.refreshAction = this.addAction("refresh-cw", "Refresh", () => {
			void this.loadProjects();
		});

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() =>
			this.renderContent()
		);

		// Initial render
		this.renderContent();

		// Load projects
		void this.loadProjects();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();

		// Remove native header action
		if (this.refreshAction) {
			this.refreshAction.remove();
			this.refreshAction = null;
		}

		this.panelComponent?.destroy();
		this.contentComponent?.destroy();
	}

	/**
	 * Load projects by scanning vault frontmatter
	 * v15: Projects are read from frontmatter (source of truth)
	 */
	private async loadProjects(): Promise<void> {
		this.stateManager.setLoading(true);

		try {
			const frontmatterService =
				this.plugin.flashcardManager.getFrontmatterService();
			const files = this.app.vault.getMarkdownFiles();

			// Scan all files for projects in frontmatter
			const projectNoteCounts = new Map<string, number>();
			const sourceUidToProjects = new Map<string, string[]>();

			for (const file of files) {
				const content = await this.app.vault.cachedRead(file);
				const projects =
					frontmatterService.extractProjectsFromFrontmatter(content);

				for (const projectName of projects) {
					projectNoteCounts.set(
						projectName,
						(projectNoteCounts.get(projectName) || 0) + 1
					);
				}

				// Build source_uid -> projects map for card counting
				if (projects.length > 0) {
					const cache = this.app.metadataCache.getFileCache(file);
					const uid = cache?.frontmatter?.flashcard_uid as
						| string
						| undefined;
					if (uid) {
						sourceUidToProjects.set(uid, projects);
					}
				}
			}

			// Count cards per project
			const projectCardCounts = new Map<string, number>();
			const projectNewCounts = new Map<string, number>();
			const projectLearningCounts = new Map<string, number>();
			const projectDueCounts = new Map<string, number>();
			const allCards = this.plugin.cardStore.cards.getAll();
			const now = new Date();
			const tomorrowBoundary =
				this.plugin.dayBoundaryService.getTomorrowBoundary(now);

			for (const card of allCards) {
				if (!card.sourceUid) continue;
				const projects = sourceUidToProjects.get(card.sourceUid) || [];
				for (const projectName of projects) {
					// Total card count
					projectCardCounts.set(
						projectName,
						(projectCardCounts.get(projectName) || 0) + 1
					);

					// New count: State.New cards (blue in Anki)
					if (card.state === State.New) {
						projectNewCounts.set(
							projectName,
							(projectNewCounts.get(projectName) || 0) + 1
						);
					}

					const dueDate = new Date(card.due);

					// Learning count: Learning/Relearning cards due (orange in Anki)
					if (
						(card.state === State.Learning ||
							card.state === State.Relearning) &&
						dueDate <= now
					) {
						projectLearningCounts.set(
							projectName,
							(projectLearningCounts.get(projectName) || 0) + 1
						);
					}

					// Due count: Review cards due today (green in Anki)
					if (
						card.state === State.Review &&
						dueDate < tomorrowBoundary
					) {
						projectDueCounts.set(
							projectName,
							(projectDueCounts.get(projectName) || 0) + 1
						);
					}
				}
			}

			// v16: Projects come from frontmatter only (no database)
			const projects = Array.from(projectNoteCounts.keys())
				.map((name) => ({
					id: name, // Use name as ID (no DB)
					name,
					noteCount: projectNoteCounts.get(name) ?? 0,
					cardCount: projectCardCounts.get(name) ?? 0,
					dueCount: projectDueCounts.get(name) ?? 0,
					newCount: projectNewCounts.get(name) ?? 0,
					learningCount: projectLearningCounts.get(name) ?? 0,
				}))
				.sort((a, b) => a.name.localeCompare(b.name));

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
	private async handleDeleteProject(projectId: string): Promise<void> {
		const state = this.stateManager.getState();
		const project = state.projects.find((p) => p.id === projectId);
		if (!project) return;

		// Confirm deletion
		const confirmMessage =
			project.noteCount > 0
				? `Delete project "${project.name}"? This will remove it from ${project.noteCount} note(s).`
				: `Delete project "${project.name}"?`;

		if (!confirm(confirmMessage)) {
			return;
		}

		try {
			const frontmatterService =
				this.plugin.flashcardManager.getFrontmatterService();
			const files = this.app.vault.getMarkdownFiles();

			// Find all notes with this project in frontmatter and remove it
			for (const file of files) {
				const content = await this.app.vault.cachedRead(file);
				const projects =
					frontmatterService.extractProjectsFromFrontmatter(content);

				if (projects.includes(project.name)) {
					// Remove project from frontmatter
					const updatedProjects = projects.filter(
						(p) => p !== project.name
					);
					await frontmatterService.setProjectsInFrontmatter(
						file,
						updatedProjects
					);
				}
			}

			// v16: No database deletion - projects are in frontmatter only

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
		if (
			state.projects.some(
				(p) => p.name.toLowerCase() === projectName.toLowerCase()
			)
		) {
			new Notice(`Project "${projectName}" already exists`);
			return;
		}

		// Create project and add note to it
		await this.createProjectFromNote(note, projectName);
	}

	/**
	 * Create a project from a note and add that note to the project
	 * v16: Projects only in frontmatter (no database)
	 */
	private async createProjectFromNote(
		note: TFile,
		projectName: string
	): Promise<void> {
		try {
			const frontmatterService =
				this.plugin.flashcardManager.getFrontmatterService();

			// Get or create source note UID
			let sourceUid = await frontmatterService.getSourceNoteUid(note);
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(note, sourceUid);
			}

			// Add project to note frontmatter (v16: frontmatter is source of truth)
			await frontmatterService.setProjectsInFrontmatter(note, [
				projectName,
			]);

			// Refresh projects list
			await this.loadProjects();

			new Notice(`Project "${projectName}" created from note`);
		} catch (error) {
			console.error(
				"[ProjectsView] Error creating project from note:",
				error
			);
			new Notice("Failed to create project from note");
		}
	}

	/**
	 * Handle adding notes to a project
	 * v15: Simplified - opens note selector instead of orphaned notes
	 */
	private async handleAddNotesToProject(
		projectId: string,
		projectName: string
	): Promise<void> {
		const modal = new SelectNoteModal(this.app, {
			title: `Add Note to "${projectName}"`,
			excludeFlashcardFiles: true,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.selectedNote) return;

		await this.addNoteToProject(result.selectedNote, projectName);
	}

	/**
	 * Add a single note to a project (update frontmatter)
	 */
	private async addNoteToProject(
		note: TFile,
		projectName: string
	): Promise<void> {
		const frontmatterService =
			this.plugin.flashcardManager.getFrontmatterService();

		try {
			// Get current projects for this note
			const content = await this.app.vault.cachedRead(note);
			const currentProjects =
				frontmatterService.extractProjectsFromFrontmatter(content);

			if (currentProjects.includes(projectName)) {
				new Notice(`Note already in project "${projectName}"`);
				return;
			}

			// Add project to frontmatter
			const newProjects = [...currentProjects, projectName];
			await frontmatterService.setProjectsInFrontmatter(
				note,
				newProjects
			);

			// Ensure source note has UID
			let sourceUid = await frontmatterService.getSourceNoteUid(note);
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(note, sourceUid);
			}

			new Notice(`Added "${note.basename}" to "${projectName}"`);
			await this.loadProjects();
		} catch (error) {
			console.error(
				`[ProjectsView] Error adding note to project:`,
				error
			);
			new Notice("Failed to add note to project");
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
			onAddNotes: (id, name) =>
				void this.handleAddNotesToProject(id, name),
			onCreateFromNote: () => void this.handleCreateFromNote(),
			onRefresh: () => void this.loadProjects(),
		});
		this.contentComponent.render();
	}
}
