/**
 * Projects View
 * Panel-based view for managing projects
 *
 * v15: Projects are read from frontmatter (source of truth)
 * v19: Uses FrontmatterIndexService for O(1) project lookups
 */
import { ItemView, WorkspaceLeaf, Notice, TFile, Platform, Menu } from "obsidian";
import { State } from "ts-fsrs";
import { VIEW_TYPE_PROJECTS, VIEW_TYPE_REVIEW } from "../../constants";
import { createProjectsStateManager } from "../../state/projects.state";
import { getEventBus } from "../../services";
import { Panel } from "../components/Panel";
import { ProjectsContent } from "./ProjectsContent";
import { SelectionFooter } from "../components";
import { SelectNoteModal } from "../modals";
import type TrueRecallPlugin from "../../main";
import type { ProjectNoteInfo } from "../../types";
import type { CardReviewedEvent, BulkChangeEvent } from "../../types/events.types";

/**
 * Projects View
 * Panel for managing projects (CRUD, review)
 */
export class ProjectsView extends ItemView {
	private plugin: TrueRecallPlugin;
	private stateManager = createProjectsStateManager();

	// UI Components
	private panelComponent: Panel | null = null;
	private contentComponent: ProjectsContent | null = null;
	private selectionFooterComponent: SelectionFooter | null = null;

	// Native header action elements
	private refreshAction: HTMLElement | null = null;

	// State subscription
	private unsubscribe: (() => void) | null = null;

	// Event subscriptions for cross-component reactivity
	private eventUnsubscribers: (() => void)[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
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

	/**
	 * Add items to the native "..." menu (mobile)
	 */
	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);

		if (!Platform.isMobile) return;

		menu.addItem((item) => {
			item.setTitle("Refresh")
				.setIcon("refresh-cw")
				.onClick(() => void this.loadProjects());
		});

		menu.addItem((item) => {
			item.setTitle("New project")
				.setIcon("plus")
				.onClick(() => void this.handleCreateFromNote());
		});
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();

		// Create Panel component (header is native Obsidian header)
		this.panelComponent = new Panel(container, { showFooter: true });
		this.panelComponent.render();

		// Add native refresh action (desktop only - on mobile it's in "..." menu)
		if (!Platform.isMobile) {
			this.refreshAction = this.addAction("refresh-cw", "Refresh", () => {
				void this.loadProjects();
			});
		}

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() =>
			this.renderContent()
		);

		// Initial render
		this.renderContent();

		// Load projects
		void this.loadProjects();

		// Subscribe to EventBus for reactive updates
		this.subscribeToEvents();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();

		// Cleanup EventBus subscriptions
		this.eventUnsubscribers.forEach((unsub) => unsub());
		this.eventUnsubscribers = [];

		// Remove native header action
		if (this.refreshAction) {
			this.refreshAction.remove();
			this.refreshAction = null;
		}

		this.panelComponent?.destroy();
		this.contentComponent?.destroy();
		this.selectionFooterComponent?.destroy();
	}

	/**
	 * Load projects using FrontmatterIndexService for O(1) lookups
	 * v19: Uses FrontmatterIndexService instead of scanning all files
	 */
	private async loadProjects(): Promise<void> {
		this.stateManager.setLoading(true);

		try {
			const frontmatterIndex = this.plugin.frontmatterIndex;

			// Get all project names from index (O(1))
			const allProjectNames = frontmatterIndex.getAllValues("projects");

			// Build project stats and notes using index
			const projectNoteCounts = new Map<string, number>();
			const projectNotes = new Map<string, ProjectNoteInfo[]>();
			const sourceUidToProjects = new Map<string, string[]>();

			for (const projectName of allProjectNames) {
				// Get files for this project from index (O(1) per project)
				const files = frontmatterIndex.getFilesByValue("projects", projectName);

				// Build notes array for this project
				const notes: ProjectNoteInfo[] = [];
				for (const file of files) {
					const uid = frontmatterIndex.getValues("flashcard_uid", file.path)[0];
					if (uid) {
						const existing = sourceUidToProjects.get(uid) ?? [];
						if (!existing.includes(projectName)) {
							existing.push(projectName);
							sourceUidToProjects.set(uid, existing);
						}
					}

					// Skip the main project note (note with same name as project)
					if (file.basename === projectName) {
						continue;
					}

					// Add note to project's notes array
					notes.push({
						path: file.path,
						name: file.basename,
						cardCount: 0, // Will be updated after card counting
						newCount: 0,
						learningCount: 0,
						dueCount: 0,
					});
				}
				projectNotes.set(projectName, notes);
				// Set count after filtering out main project note
				projectNoteCounts.set(projectName, notes.length);
			}

			// Count cards per project and per note
			const projectCardCounts = new Map<string, number>();
			const projectNewCounts = new Map<string, number>();
			const projectLearningCounts = new Map<string, number>();
			const projectDueCounts = new Map<string, number>();
			const noteCardCounts = new Map<string, Map<string, number>>(); // projectName -> notePath -> count
			// Per-note state counts: notePath -> { newCount, learningCount, dueCount }
			const noteStateCounts = new Map<string, { newCount: number; learningCount: number; dueCount: number }>();
			const allCards = this.plugin.cardStore.cards.getAll();
			const now = new Date();
			const tomorrowBoundary =
				this.plugin.dayBoundaryService.getTomorrowBoundary(now);

			// Filter out suspended and buried cards (consistent with ReviewView)
			const activeCards = allCards.filter((card) => {
				if (card.suspended) return false;
				if (card.buriedUntil) {
					const buriedUntil = new Date(card.buriedUntil);
					if (buriedUntil > now) return false;
				}
				return true;
			});

			for (const card of activeCards) {
				if (!card.sourceUid) continue;
				const projects = sourceUidToProjects.get(card.sourceUid) || [];

				// Find the source file path for this card
				const sourceFile = frontmatterIndex.getFilesByValue("flashcard_uid", card.sourceUid)[0];
				if (!sourceFile) continue;

				for (const projectName of projects) {
					// Total card count
					projectCardCounts.set(
						projectName,
						(projectCardCounts.get(projectName) || 0) + 1
					);

					// Update note-level card count
					if (!noteCardCounts.has(projectName)) {
						noteCardCounts.set(projectName, new Map());
					}
					const noteCounts = noteCardCounts.get(projectName)!;
					noteCounts.set(sourceFile.path, (noteCounts.get(sourceFile.path) || 0) + 1);

					// Initialize per-note state counts if needed
					if (!noteStateCounts.has(sourceFile.path)) {
						noteStateCounts.set(sourceFile.path, { newCount: 0, learningCount: 0, dueCount: 0 });
					}
					const noteStats = noteStateCounts.get(sourceFile.path)!;

					// New count: State.New cards (blue in Anki)
					if (card.state === State.New) {
						projectNewCounts.set(
							projectName,
							(projectNewCounts.get(projectName) || 0) + 1
						);
						noteStats.newCount++;
					}

					const dueDate = new Date(card.due);

					// Learning count: All Learning/Relearning cards (orange in Anki)
					if (
						card.state === State.Learning ||
						card.state === State.Relearning
					) {
						projectLearningCounts.set(
							projectName,
							(projectLearningCounts.get(projectName) || 0) + 1
						);
						noteStats.learningCount++;
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
						noteStats.dueCount++;
					}
				}
			}

			// Build final projects array with notes
			const projects = Array.from(projectNoteCounts.keys())
				.map((name) => {
					const rawNotes = projectNotes.get(name) ?? [];
					const noteCountsForProject = noteCardCounts.get(name);

					// Apply card counts to notes
					const notesWithCounts = rawNotes.map(note => {
						const stats = noteStateCounts.get(note.path);
						return {
							...note,
							cardCount: noteCountsForProject?.get(note.path) ?? 0,
							newCount: stats?.newCount ?? 0,
							learningCount: stats?.learningCount ?? 0,
							dueCount: stats?.dueCount ?? 0,
						};
					});

					return {
						id: name,
						name,
						noteCount: projectNoteCounts.get(name) ?? 0,
						cardCount: projectCardCounts.get(name) ?? 0,
						dueCount: projectDueCounts.get(name) ?? 0,
						newCount: projectNewCounts.get(name) ?? 0,
						learningCount: projectLearningCounts.get(name) ?? 0,
						notes: notesWithCounts,
					};
				})
				.sort((a, b) => a.name.localeCompare(b.name));

			this.stateManager.setProjects(projects);
		} catch (error) {
			console.error("[ProjectsView] Error loading projects:", error);
			new Notice("Failed to load projects");
			this.stateManager.setLoading(false);
		}
	}

	/**
	 * Subscribe to EventBus events for cross-component reactivity
	 */
	private subscribeToEvents(): void {
		const eventBus = getEventBus();

		// Refresh project stats when cards are reviewed
		const unsubReviewed = eventBus.on<CardReviewedEvent>("card:reviewed", () => {
			void this.updateProjectStatsOnly();
		});
		this.eventUnsubscribers.push(unsubReviewed);

		// Refresh on bulk changes (suspend, bury, delete, etc.)
		const unsubBulk = eventBus.on<BulkChangeEvent>("cards:bulk-change", () => {
			void this.loadProjects();
		});
		this.eventUnsubscribers.push(unsubBulk);
	}

	/**
	 * Update project statistics only (no full project list reload)
	 * Recalculates due/new/learning counts from current card store
	 */
	private async updateProjectStatsOnly(): Promise<void> {
		const state = this.stateManager.getState();
		if (state.isLoading) return;

		const frontmatterIndex = this.plugin.frontmatterIndex;
		const allCards = this.plugin.cardStore.cards.getAll();
		const now = new Date();
		const tomorrowBoundary = this.plugin.dayBoundaryService.getTomorrowBoundary(now);

		// Build sourceUid -> projects map and sourceUid -> filePath map
		const sourceUidToProjects = new Map<string, string[]>();
		const sourceUidToPath = new Map<string, string>();
		for (const projectName of frontmatterIndex.getAllValues("projects")) {
			const files = frontmatterIndex.getFilesByValue("projects", projectName);
			for (const file of files) {
				const uid = frontmatterIndex.getValues("flashcard_uid", file.path)[0];
				if (uid) {
					const existing = sourceUidToProjects.get(uid) ?? [];
					if (!existing.includes(projectName)) {
						existing.push(projectName);
						sourceUidToProjects.set(uid, existing);
					}
					sourceUidToPath.set(uid, file.path);
				}
			}
		}

		// Filter active cards
		const activeCards = allCards.filter((card) => {
			if (card.suspended) return false;
			if (card.buriedUntil) {
				const buriedUntil = new Date(card.buriedUntil);
				if (buriedUntil > now) return false;
			}
			return true;
		});

		// Recalculate counts per project and per note
		const projectCardCounts = new Map<string, number>();
		const projectNewCounts = new Map<string, number>();
		const projectLearningCounts = new Map<string, number>();
		const projectDueCounts = new Map<string, number>();
		const noteStateCounts = new Map<string, { newCount: number; learningCount: number; dueCount: number }>();

		for (const card of activeCards) {
			if (!card.sourceUid) continue;
			const projects = sourceUidToProjects.get(card.sourceUid) || [];
			const notePath = sourceUidToPath.get(card.sourceUid);

			// Initialize per-note state counts if needed
			if (notePath && !noteStateCounts.has(notePath)) {
				noteStateCounts.set(notePath, { newCount: 0, learningCount: 0, dueCount: 0 });
			}
			const noteStats = notePath ? noteStateCounts.get(notePath) : undefined;

			for (const projectName of projects) {
				projectCardCounts.set(
					projectName,
					(projectCardCounts.get(projectName) || 0) + 1
				);

				if (card.state === State.New) {
					projectNewCounts.set(
						projectName,
						(projectNewCounts.get(projectName) || 0) + 1
					);
					if (noteStats) noteStats.newCount++;
				}

				const dueDate = new Date(card.due);
				if (card.state === State.Learning || card.state === State.Relearning) {
					projectLearningCounts.set(
						projectName,
						(projectLearningCounts.get(projectName) || 0) + 1
					);
					if (noteStats) noteStats.learningCount++;
				}

				if (card.state === State.Review && dueDate < tomorrowBoundary) {
					projectDueCounts.set(
						projectName,
						(projectDueCounts.get(projectName) || 0) + 1
					);
					if (noteStats) noteStats.dueCount++;
				}
			}
		}

		// Update existing projects with new counts (in-place update)
		const updatedProjects = state.projects.map(project => ({
			...project,
			cardCount: projectCardCounts.get(project.name) ?? project.cardCount,
			newCount: projectNewCounts.get(project.name) ?? 0,
			learningCount: projectLearningCounts.get(project.name) ?? 0,
			dueCount: projectDueCounts.get(project.name) ?? 0,
			notes: project.notes.map(note => {
				const stats = noteStateCounts.get(note.path);
				return {
					...note,
					newCount: stats?.newCount ?? 0,
					learningCount: stats?.learningCount ?? 0,
					dueCount: stats?.dueCount ?? 0,
				};
			}),
		}));

		this.stateManager.setProjects(updatedProjects);
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
	 * Handle starting a review session with selected notes
	 */
	private async handleStartReviewSelected(): Promise<void> {
		const state = this.stateManager.getState();
		const selectedPaths = Array.from(state.selectedNotePaths);

		if (selectedPaths.length === 0) {
			new Notice("No notes selected");
			return;
		}

		// Get source UIDs for selected notes
		const frontmatterIndex = this.plugin.frontmatterIndex;
		const sourceUids: string[] = [];

		for (const path of selectedPaths) {
			const uids = frontmatterIndex.getValues("flashcard_uid", path);
			if (uids.length > 0 && uids[0]) {
				sourceUids.push(uids[0]);
			}
		}

		if (sourceUids.length === 0) {
			new Notice("Selected notes have no flashcards");
			return;
		}

		// Exit selection mode
		this.stateManager.exitSelectionMode();

		// Open review view with sourceNoteFilters
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
				sourceNoteFilters: sourceUids,
				ignoreDailyLimits: true,
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

		// Create component once, then just update props
		if (!this.contentComponent) {
			contentContainer.empty();
			this.contentComponent = new ProjectsContent(contentContainer, {
				isLoading: state.isLoading,
				projectsWithCards,
				emptyProjects,
				searchQuery: state.searchQuery,
				expandedProjectIds: state.expandedProjectIds,
				app: this.app,
				component: this,
				onSearchChange: (query) => this.stateManager.setSearchQuery(query),
				onStartReview: (name) => void this.handleStartReview(name),
				onDelete: (id) => void this.handleDeleteProject(id),
				onAddNotes: (id, name) =>
					void this.handleAddNotesToProject(id, name),
				onCreateFromNote: () => void this.handleCreateFromNote(),
				onRefresh: () => void this.loadProjects(),
				onToggleExpand: (id) => this.stateManager.toggleProjectExpanded(id),
				// Selection props
				selectionMode: state.selectionMode,
				selectedNotePaths: state.selectedNotePaths,
				onEnterSelectionMode: (path) =>
					this.stateManager.enterSelectionMode(path),
				onExitSelectionMode: () => this.stateManager.exitSelectionMode(),
				onToggleNoteSelection: (path) =>
					this.stateManager.toggleNoteSelection(path),
			});
			this.contentComponent.render();
		} else {
			// Just update props - don't destroy/recreate
			this.contentComponent.updateProps({
				isLoading: state.isLoading,
				projectsWithCards,
				emptyProjects,
				searchQuery: state.searchQuery,
				expandedProjectIds: state.expandedProjectIds,
				selectionMode: state.selectionMode,
				selectedNotePaths: state.selectedNotePaths,
			});
		}

		// Render selection footer when in selection mode
		this.renderSelectionFooter();
	}

	/**
	 * Render selection footer (only in selection mode)
	 */
	private renderSelectionFooter(): void {
		const footerContainer = this.panelComponent?.getFooterContainer();
		if (!footerContainer) return;

		const state = this.stateManager.getState();

		// Clean up existing footer
		this.selectionFooterComponent?.destroy();
		this.selectionFooterComponent = null;
		footerContainer.empty();

		// Only show footer in selection mode
		if (state.selectionMode === "selecting") {
			// Calculate sums from selected notes
			const selectedPaths = state.selectedNotePaths;
			let newCount = 0;
			let learningCount = 0;
			let dueCount = 0;

			// Iterate through all projects and their notes to sum counts
			for (const project of state.projects) {
				for (const note of project.notes) {
					if (selectedPaths.has(note.path)) {
						newCount += note.newCount;
						learningCount += note.learningCount;
						dueCount += note.dueCount;
					}
				}
			}

			this.selectionFooterComponent = new SelectionFooter(
				footerContainer,
				{
					display: { type: "cardCounts", newCount, learningCount, dueCount },
					actions: [
						{
							label: "Review Selected",
							icon: "play",
							onClick: () => void this.handleStartReviewSelected(),
							variant: "primary",
							disabled: newCount + learningCount + dueCount === 0,
						},
					],
					onCancel: () => this.stateManager.exitSelectionMode(),
				}
			);
			this.selectionFooterComponent.render();
		}
	}
}
