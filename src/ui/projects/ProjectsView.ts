/**
 * v15: Projects are read from frontmatter (source of truth)
 * v19: Uses FrontmatterIndexService for O(1) project lookups
 */
import { ItemView, WorkspaceLeaf, TFile, Platform, Menu } from "obsidian";
import { State } from "ts-fsrs";
import { VIEW_TYPE_PROJECTS, VIEW_TYPE_REVIEW } from "../../constants";
import { getEventBus, notify } from "../../services";
import { Panel } from "../components/Panel";
import { ProjectsContent } from "./ProjectsContent";
import { SelectionFooter } from "../components";
import { SelectNoteModal, AddToProjectModal } from "../modals";
import { filterActiveCardsOnly } from "../shared/helpers";
import type TrueRecallPlugin from "../../main";
import type { ProjectNoteInfo } from "../../types";
import type { CardReviewedEvent, BulkChangeEvent } from "../../types/events.types";
import type { ProjectsApi } from "../../state/store";

export class ProjectsView extends ItemView {
	private plugin: TrueRecallPlugin;
	private panelComponent: Panel | null = null;
	private contentComponent: ProjectsContent | null = null;
	private selectionFooterComponent: SelectionFooter | null = null;
	private refreshAction: HTMLElement | null = null;
	private unsubscribe: (() => void) | null = null;
	private eventUnsubscribers: (() => void)[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	private get projects(): ProjectsApi {
		return this.plugin.store!.getState().projects;
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

		this.panelComponent = new Panel(container, { showFooter: true });
		this.panelComponent.render();

		if (!Platform.isMobile) {
			this.refreshAction = this.addAction("refresh-cw", "Refresh", () => {
				void this.loadProjects();
			});
		}

		this.unsubscribe = this.plugin.store!.subscribe(
			(state) => state.projects,
			() => this.renderContent()
		);

		this.renderContent();
		void this.loadProjects();
		this.subscribeToEvents();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.eventUnsubscribers.forEach((unsub) => unsub());
		this.eventUnsubscribers = [];

		if (this.refreshAction) {
			this.refreshAction.remove();
			this.refreshAction = null;
		}

		this.panelComponent?.destroy();
		this.contentComponent?.destroy();
		this.selectionFooterComponent?.destroy();
	}

	private async loadProjects(): Promise<void> {
		this.projects.setLoading(true);

		try {
			const frontmatterIndex = this.plugin.frontmatterIndex;
			const allProjectNames = frontmatterIndex.getAllValues("projects");
			const projectNoteCounts = new Map<string, number>();
			const projectNotes = new Map<string, ProjectNoteInfo[]>();
			const sourceUidToProjects = new Map<string, string[]>();

			for (const projectName of allProjectNames) {
				const files = frontmatterIndex.getFilesByValue("projects", projectName);
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
				projectNoteCounts.set(projectName, notes.length);
			}

			const projectCardCounts = new Map<string, number>();
			const projectNewCounts = new Map<string, number>();
			const projectLearningCounts = new Map<string, number>();
			const projectDueCounts = new Map<string, number>();
			const noteCardCounts = new Map<string, Map<string, number>>();
			const uidStateCounts = new Map<string, { newCount: number; learningCount: number; dueCount: number }>();
			const uidCardCounts = new Map<string, number>();
			const sourceUidToPath = new Map<string, string>();
			const allCards = this.plugin.cardStore.cards.getAll();
			const now = new Date();
			const tomorrowBoundary =
				this.plugin.dayBoundaryService.getTomorrowBoundary(now);
			const activeCards = filterActiveCardsOnly(allCards, { now });

			for (const card of activeCards) {
				if (!card.sourceUid) continue;

				uidCardCounts.set(card.sourceUid, (uidCardCounts.get(card.sourceUid) || 0) + 1);

				const projects = sourceUidToProjects.get(card.sourceUid) || [];
				const sourceFile = frontmatterIndex.getFilesByValue("flashcard_uid", card.sourceUid)[0];
				if (!sourceFile) continue;

				if (!sourceUidToPath.has(card.sourceUid)) {
					sourceUidToPath.set(card.sourceUid, sourceFile.path);
				}

				if (!uidStateCounts.has(card.sourceUid)) {
					uidStateCounts.set(card.sourceUid, { newCount: 0, learningCount: 0, dueCount: 0 });
				}
				const uidStats = uidStateCounts.get(card.sourceUid)!;

				const dueDate = new Date(card.due);
				const isNew = card.state === State.New;
				const isLearning = card.state === State.Learning || card.state === State.Relearning;
				const isDue = card.state === State.Review && dueDate < tomorrowBoundary;

				if (isNew) uidStats.newCount++;
				if (isLearning) uidStats.learningCount++;
				if (isDue) uidStats.dueCount++;

				for (const projectName of projects) {
					projectCardCounts.set(
						projectName,
						(projectCardCounts.get(projectName) || 0) + 1
					);

					if (!noteCardCounts.has(projectName)) {
						noteCardCounts.set(projectName, new Map());
					}
					const noteCounts = noteCardCounts.get(projectName)!;
					noteCounts.set(sourceFile.path, (noteCounts.get(sourceFile.path) || 0) + 1);

					if (isNew) {
						projectNewCounts.set(
							projectName,
							(projectNewCounts.get(projectName) || 0) + 1
						);
					}

					if (isLearning) {
						projectLearningCounts.set(
							projectName,
							(projectLearningCounts.get(projectName) || 0) + 1
						);
					}

					if (isDue) {
						projectDueCounts.set(
							projectName,
							(projectDueCounts.get(projectName) || 0) + 1
						);
					}
				}
			}

			const projects = Array.from(projectNoteCounts.keys())
				.map((name) => {
					const rawNotes = projectNotes.get(name) ?? [];
					const noteCountsForProject = noteCardCounts.get(name);
					const notesWithCounts = rawNotes.map(note => {
						const uid = frontmatterIndex.getValues("flashcard_uid", note.path)[0];
						const stats = uid ? uidStateCounts.get(uid) : undefined;
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

			// O(U) where U = unique source UIDs with cards (vs O(N*M) before)
			const unassignedNotes: ProjectNoteInfo[] = [];

			for (const [uid, stats] of uidStateCounts) {
				const projects = sourceUidToProjects.get(uid);
				if (projects && projects.length > 0) continue;

				const filePath = sourceUidToPath.get(uid);
				if (!filePath) continue;

				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile)) continue;

				unassignedNotes.push({
					path: filePath,
					name: file.basename,
					cardCount: uidCardCounts.get(uid) ?? 0,
					newCount: stats.newCount,
					learningCount: stats.learningCount,
					dueCount: stats.dueCount,
				});
			}

			// Sort unassigned notes alphabetically
			unassignedNotes.sort((a, b) => a.name.localeCompare(b.name));
			this.projects.setProjects(projects);
			this.projects.setUnassignedNotes(unassignedNotes);
		} catch (error) {
			console.error("[ProjectsView] Error loading projects:", error);
			notify().error("Failed to load projects");
			this.projects.setLoading(false);
		}
	}

	private subscribeToEvents(): void {
		const eventBus = getEventBus();

		const unsubReviewed = eventBus.on<CardReviewedEvent>("card:reviewed", () => {
			void this.updateProjectStatsOnly();
		});
		this.eventUnsubscribers.push(unsubReviewed);

		const unsubBulk = eventBus.on<BulkChangeEvent>("cards:bulk-change", () => {
			void this.loadProjects();
		});
		this.eventUnsubscribers.push(unsubBulk);
	}

	private async updateProjectStatsOnly(): Promise<void> {
		const state = this.projects;
		if (state.isLoading) return;

		const frontmatterIndex = this.plugin.frontmatterIndex;
		const allCards = this.plugin.cardStore.cards.getAll();
		const now = new Date();
		const tomorrowBoundary = this.plugin.dayBoundaryService.getTomorrowBoundary(now);

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

		const activeCards = filterActiveCardsOnly(allCards, { now });
		const projectCardCounts = new Map<string, number>();
		const projectNewCounts = new Map<string, number>();
		const projectLearningCounts = new Map<string, number>();
		const projectDueCounts = new Map<string, number>();
		const noteStateCounts = new Map<string, { newCount: number; learningCount: number; dueCount: number }>();

		for (const card of activeCards) {
			if (!card.sourceUid) continue;
			const projects = sourceUidToProjects.get(card.sourceUid) || [];
			const notePath = sourceUidToPath.get(card.sourceUid);

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

		this.projects.setProjects(updatedProjects);
	}

	private async handleDeleteProject(projectId: string): Promise<void> {
		const state = this.projects;
		const project = state.projects.find((p) => p.id === projectId);
		if (!project) return;

		const confirmMessage =
			project.noteCount > 0
				? `Delete project "${project.name}"? This will remove it from ${project.noteCount} note(s).`
				: `Delete project "${project.name}"?`;

		// eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
		if (!window.confirm(confirmMessage)) {
			return;
		}

		try {
			const frontmatterService =
				this.plugin.flashcardManager.getFrontmatterService();
			const files = this.app.vault.getMarkdownFiles();

			for (const file of files) {
				const content = await this.app.vault.cachedRead(file);
				const projects =
					frontmatterService.extractProjectsFromFrontmatter(content);

				if (projects.includes(project.name)) {
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

			this.projects.removeProject(projectId);
			notify().success(`Project "${project.name}" deleted`);
		} catch (error) {
			console.error("[ProjectsView] Error deleting project:", error);
			notify().error("Failed to delete project");
		}
	}

	private async handleStartReview(projectName: string): Promise<void> {
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

		void this.app.workspace.revealLeaf(leaf);
	}

	private async handleStartReviewUnassigned(): Promise<void> {
		const state = this.projects;
		const unassignedNotes = state.unassignedNotes;

		if (unassignedNotes.length === 0) {
			notify().warning("No unassigned notes");
			return;
		}

		const noteNames = unassignedNotes.map(note => note.name);
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
				sourceNoteFilters: noteNames,
				ignoreDailyLimits: true,
			},
		});

		void this.app.workspace.revealLeaf(leaf);
	}

	private async handleStartReviewSelected(): Promise<void> {
		const state = this.projects;
		const selectedPaths = Array.from(state.selectedNotePaths);

		if (selectedPaths.length === 0) {
			notify().warning("No notes selected");
			return;
		}

		// ReviewService.filterCards() expects note names in sourceNoteFilters, not UIDs
		const noteNames: string[] = [];

		for (const path of selectedPaths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				noteNames.push(file.basename);
			}
		}

		if (noteNames.length === 0) {
			notify().warning("Could not resolve note names");
			return;
		}

		this.projects.exitSelectionMode();
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
				sourceNoteFilters: noteNames,
				ignoreDailyLimits: true,
			},
		});

		void this.app.workspace.revealLeaf(leaf);
	}

	private async handleCreateFromNote(): Promise<void> {
		const modal = new SelectNoteModal(this.app, {
			title: "Create Project from Note",
			excludeFlashcardFiles: true,
		});
		const result = await modal.openAndWait();
		if (result.cancelled || !result.selectedNote) return;

		const note = result.selectedNote;
		const projectName = note.basename;
		const state = this.projects;
		if (
			state.projects.some(
				(p) => p.name.toLowerCase() === projectName.toLowerCase()
			)
		) {
			notify().warning(`Project "${projectName}" already exists`);
			return;
		}

		await this.createProjectFromNote(note, projectName);
	}

	// v16: Projects only in frontmatter (no database)
	private async createProjectFromNote(
		note: TFile,
		projectName: string
	): Promise<void> {
		try {
			const frontmatterService =
				this.plugin.flashcardManager.getFrontmatterService();

			let sourceUid = await frontmatterService.getSourceNoteUid(note);
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(note, sourceUid);
			}

			await frontmatterService.setProjectsInFrontmatter(note, [
				projectName,
			]);

			await this.loadProjects();

			notify().success(`Project "${projectName}" created from note`);
		} catch (error) {
			console.error(
				"[ProjectsView] Error creating project from note:",
				error
			);
			notify().error("Failed to create project from note");
		}
	}

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

	private async addNoteToProject(
		note: TFile,
		projectName: string
	): Promise<void> {
		const frontmatterService =
			this.plugin.flashcardManager.getFrontmatterService();

		try {
			const content = await this.app.vault.cachedRead(note);
			const currentProjects =
				frontmatterService.extractProjectsFromFrontmatter(content);

			if (currentProjects.includes(projectName)) {
				notify().info(`Note already in project "${projectName}"`);
				return;
			}

			const newProjects = [...currentProjects, projectName];
			await frontmatterService.setProjectsInFrontmatter(
				note,
				newProjects
			);

			let sourceUid = await frontmatterService.getSourceNoteUid(note);
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(note, sourceUid);
			}

			notify().success(`Added "${note.basename}" to "${projectName}"`);
			await this.loadProjects();
		} catch (error) {
			console.error(
				`[ProjectsView] Error adding note to project:`,
				error
			);
			notify().error("Failed to add note to project");
		}
	}

	private renderContent(): void {
		if (!this.panelComponent) return;

		const state = this.projects;
		const projectsWithCards = this.projects.getProjectsWithCards();
		const emptyProjects = this.projects.getEmptyProjects();

		const contentContainer = this.panelComponent.getContentContainer();

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
				onSearchChange: (query) => this.projects.setSearchQuery(query),
				onStartReview: (name) => void this.handleStartReview(name),
				onDelete: (id) => void this.handleDeleteProject(id),
				onAddNotes: (id, name) =>
					void this.handleAddNotesToProject(id, name),
				onCreateFromNote: () => void this.handleCreateFromNote(),
				onRefresh: () => void this.loadProjects(),
				onToggleExpand: (id) => this.projects.toggleProjectExpanded(id),
				selectionMode: state.selectionMode,
				selectedNotePaths: state.selectedNotePaths,
				onEnterSelectionMode: (path) =>
					this.projects.enterSelectionMode(path),
				onExitSelectionMode: () => this.projects.exitSelectionMode(),
				onToggleNoteSelection: (path) =>
					this.projects.toggleNoteSelection(path),
				unassignedNotes: state.unassignedNotes,
				isUnassignedExpanded: state.isUnassignedExpanded,
				onToggleUnassignedExpanded: () => this.projects.toggleUnassignedExpanded(),
				onStartReviewUnassigned: () => void this.handleStartReviewUnassigned(),
				showDoneNotes: state.showDoneNotes,
				onToggleShowDoneNotes: () => this.projects.toggleShowDoneNotes(),
			});
			this.contentComponent.render();
		} else {
			this.contentComponent.updateProps({
				isLoading: state.isLoading,
				projectsWithCards,
				emptyProjects,
				searchQuery: state.searchQuery,
				expandedProjectIds: state.expandedProjectIds,
				selectionMode: state.selectionMode,
				selectedNotePaths: state.selectedNotePaths,
				unassignedNotes: state.unassignedNotes,
				isUnassignedExpanded: state.isUnassignedExpanded,
				showDoneNotes: state.showDoneNotes,
			});
		}

		this.renderSelectionFooter();
	}

	private renderSelectionFooter(): void {
		const footerContainer = this.panelComponent?.getFooterContainer();
		if (!footerContainer) return;

		const state = this.projects;

		this.selectionFooterComponent?.destroy();
		this.selectionFooterComponent = null;
		footerContainer.empty();

		if (state.selectionMode === "selecting") {
			const selectedPaths = state.selectedNotePaths;
			let newCount = 0;
			let learningCount = 0;
			let dueCount = 0;

			for (const project of state.projects) {
				for (const note of project.notes) {
					if (selectedPaths.has(note.path)) {
						newCount += note.newCount;
						learningCount += note.learningCount;
						dueCount += note.dueCount;
					}
				}
			}

			for (const note of state.unassignedNotes) {
				if (selectedPaths.has(note.path)) {
					newCount += note.newCount;
					learningCount += note.learningCount;
					dueCount += note.dueCount;
				}
			}

			this.selectionFooterComponent = new SelectionFooter(
				footerContainer,
				{
					display: { type: "cardCounts", newCount, learningCount, dueCount },
					actions: [
						{
							label: "Add to Project",
							icon: "folder-plus",
							onClick: () => void this.handleAddSelectedToProject(),
							variant: "secondary",
						},
						{
							label: "Review Selected",
							icon: "play",
							onClick: () => void this.handleStartReviewSelected(),
							variant: "primary",
							disabled: newCount + learningCount + dueCount === 0,
						},
					],
					onCancel: () => this.projects.exitSelectionMode(),
				}
			);
			this.selectionFooterComponent.render();
		}
	}

	private async handleAddSelectedToProject(): Promise<void> {
		const state = this.projects;
		const selectedPaths = Array.from(state.selectedNotePaths);

		if (selectedPaths.length === 0) {
			notify().warning("No notes selected");
			return;
		}

		const availableProjects = [...this.plugin.frontmatterIndex.getAllValues("projects")];

		const modal = new AddToProjectModal(this.app, {
			availableProjects,
			currentProjects: [],
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.projects.length === 0) return;

		const frontmatterService = this.plugin.flashcardManager.getFrontmatterService();

		for (const path of selectedPaths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) continue;

			const content = await this.app.vault.cachedRead(file);
			const currentProjects = frontmatterService.extractProjectsFromFrontmatter(content);
			const newProjects = [...new Set([...currentProjects, ...result.projects])];
			await frontmatterService.setProjectsInFrontmatter(file, newProjects);
		}

		this.projects.exitSelectionMode();
		await this.loadProjects();
		notify().success(`Added ${selectedPaths.length} note(s) to ${result.projects.length} project(s)`);
	}
}
