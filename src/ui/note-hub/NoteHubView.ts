import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { State } from "ts-fsrs";
import { VIEW_TYPE_NOTE_HUB, VIEW_TYPE_REVIEW } from "../../constants";
import { notify } from "../../services";
import { SelectionFooter } from "../components";
import { AddToProjectModal, SelectNoteModal } from "../modals";
import { NoteHubToolbar } from "./NoteHubToolbar";
import { NoteHubContent } from "./NoteHubContent";
import { filterActiveCardsOnly } from "../shared/helpers";
import type TrueRecallPlugin from "../../main";
import type { ProjectNoteInfo } from "../../types";
import type { NoteHubApi } from "../../state/store";

export class NoteHubView extends ItemView {
	private plugin: TrueRecallPlugin;

	private toolbarComponent: NoteHubToolbar | null = null;
	private contentComponent: NoteHubContent | null = null;
	private selectionFooterComponent: SelectionFooter | null = null;

	private mainContainer!: HTMLElement;
	private toolbarContainer!: HTMLElement;
	private contentContainer!: HTMLElement;
	private footerContainer!: HTMLElement;

	private unsubscribe: (() => void) | null = null;
	private staleUnsubscribe: (() => void) | null = null;
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	private get noteHub(): NoteHubApi {
		return this.plugin.store!.getState().noteHub;
	}

	getViewType(): string {
		return VIEW_TYPE_NOTE_HUB;
	}

	getDisplayText(): string {
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- Feature name
		return "Note Hub";
	}

	getIcon(): string {
		return "layout-grid";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass("ep:flex", "ep:flex-col", "ep:h-full", "ep:overflow-hidden", "ep:bg-obs-primary");

		this.mainContainer = container.createDiv({
			cls: "ep:flex ep:flex-col ep:flex-1 ep:overflow-hidden ep:min-h-0",
		});

		this.toolbarContainer = this.mainContainer.createDiv({
			cls: "ep:shrink-0",
		});

		this.contentContainer = this.mainContainer.createDiv({
			cls: "ep:flex-1 ep:overflow-y-auto ep:min-h-0",
		});

		this.footerContainer = this.mainContainer.createDiv({
			cls: "ep:shrink-0",
		});

		this.unsubscribe = this.plugin.store!.subscribe(
			(state) => state.noteHub,
			() => this.render()
		);

		this.staleUnsubscribe = this.plugin.store!.subscribe(
			(state) => state.noteHub.isStale,
			(isStale) => {
				if (isStale) this.scheduleRefresh();
			}
		);

		this.render();
		void this.loadData();
	}

	async onClose(): Promise<void> {
		if (this.refreshTimer) clearTimeout(this.refreshTimer);
		this.unsubscribe?.();
		this.staleUnsubscribe?.();
		this.toolbarComponent?.destroy();
		this.contentComponent?.destroy();
		this.selectionFooterComponent?.destroy();
	}

	private async loadData(): Promise<void> {
		this.noteHub.setLoading(true);

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

					if (file.basename === projectName) {
						continue;
					}

					notes.push({
						path: file.path,
						name: file.basename,
						cardCount: 0,
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
						childProjectNames: [],
						parentProjectNames: [],
					};
				})
				.sort((a, b) => a.name.localeCompare(b.name));

			const unassignedNotes: ProjectNoteInfo[] = [];

			for (const [uid, stats] of uidStateCounts) {
				const uidProjects = sourceUidToProjects.get(uid);
				if (uidProjects && uidProjects.length > 0) continue;

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

			unassignedNotes.sort((a, b) => a.name.localeCompare(b.name));
			this.noteHub.setProjects(projects);
			this.noteHub.setUnassignedNotes(unassignedNotes);
			this.noteHub.markFresh();
		} catch (error) {
			console.error("[NoteHubView] Error loading data:", error);
			notify().error("Failed to load note hub data");
			this.noteHub.setLoading(false);
		}
	}

	private render(): void {
		const state = this.noteHub;
		const filteredProjects = this.noteHub.getFilteredProjects();
		const filteredUnassigned = this.noteHub.getFilteredUnassignedNotes();

		if (!this.toolbarComponent) {
			this.toolbarComponent = new NoteHubToolbar(this.toolbarContainer, {
				searchQuery: state.searchQuery,
				statusFilter: state.statusFilter,
				sortBy: state.sortBy,
				sortDirection: state.sortDirection,
				onSearchChange: (q) => this.noteHub.setSearchQuery(q),
				onStatusFilterChange: (f) => this.noteHub.setStatusFilter(f),
				onSortByChange: (s) => this.noteHub.setSortBy(s),
				onSortDirectionToggle: () => this.noteHub.toggleSortDirection(),
				onRefresh: () => void this.loadData(),
			});
			this.toolbarComponent.render();
		} else {
			this.toolbarComponent.updateProps({
				searchQuery: state.searchQuery,
				statusFilter: state.statusFilter,
				sortBy: state.sortBy,
				sortDirection: state.sortDirection,
			});
		}

		if (!this.contentComponent) {
			this.contentContainer.empty();
			this.contentComponent = new NoteHubContent(this.contentContainer, {
				isLoading: state.isLoading,
				projects: filteredProjects,
				unassignedNotes: filteredUnassigned,
				expandedProjectIds: state.expandedProjectIds,
				selectionMode: state.selectionMode,
				selectedNotePaths: state.selectedNotePaths,
				onToggleExpand: (id) => this.noteHub.toggleProjectExpanded(id),
				onToggleNoteSelection: (path) => this.noteHub.toggleNoteSelection(path),
				onEnterSelectionMode: (path) => this.noteHub.enterSelectionMode(path),
				onOpenNote: (path) => void this.handleOpenNote(path),
				onStartReview: (filter) => void this.handleStartReview(filter),
				onStartReviewProject: (name) => void this.handleStartReviewProject(name),
				onCustomStudyProject: (name) => void this.handleCustomStudyProject(name),
				onCustomStudyNote: (filter) => void this.handleCustomStudyNote(filter),
				onGenerateCards: (path) => void this.handleGenerateCards(path),
				onAddToProject: (path) => void this.handleAddNoteToProject(path),
				onRemoveFromProject: (notePath, project) => void this.handleRemoveFromProject(notePath, project),
				onAddNotesToProject: (projectName) => void this.handleAddNotesToProject(projectName),
				app: this.app,
			});
			this.contentComponent.render();
		} else {
			this.contentComponent.updateProps({
				isLoading: state.isLoading,
				projects: filteredProjects,
				unassignedNotes: filteredUnassigned,
				expandedProjectIds: state.expandedProjectIds,
				selectionMode: state.selectionMode,
				selectedNotePaths: state.selectedNotePaths,
			});
		}

		this.renderSelectionFooter();
	}

	private renderSelectionFooter(): void {
		this.selectionFooterComponent?.destroy();
		this.selectionFooterComponent = null;
		this.footerContainer.empty();

		const state = this.noteHub;
		if (state.selectionMode !== "selecting") return;

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

		this.selectionFooterComponent = new SelectionFooter(this.footerContainer, {
			display: { type: "cardCounts", newCount, learningCount, dueCount },
			actions: [
				{
					label: "Add to Project",
					icon: "folder-plus",
					onClick: () => void this.handleBulkAddToProject(),
					variant: "secondary",
				},
				{
					label: "Review Selected",
					icon: "play",
					onClick: () => void this.handleBulkReview(),
					variant: "primary",
					disabled: newCount + learningCount + dueCount === 0,
				},
			],
			onCancel: () => this.noteHub.exitSelectionMode(),
		});
		this.selectionFooterComponent.render();
	}

	private scheduleRefresh(): void {
		if (this.refreshTimer) clearTimeout(this.refreshTimer);
		this.refreshTimer = setTimeout(() => {
			this.noteHub.markFresh();
			void this.loadData();
		}, 500);
	}

	private async handleOpenNote(path: string): Promise<void> {
		void this.app.workspace.openLinkText(path, "", false);
	}

	private async handleStartReview(filter: { sourceNoteFilters?: string[]; projectFilters?: string[] }): Promise<void> {
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
			state: { ...filter, ignoreDailyLimits: true },
		});

		void this.app.workspace.revealLeaf(leaf);
	}

	private async handleStartReviewProject(projectName: string): Promise<void> {
		await this.handleStartReview({ projectFilters: [projectName] });
	}

	private async handleCustomStudyProject(projectName: string): Promise<void> {
		await this.plugin.openCustomStudyModal({
			projectFilters: [projectName],
			scopeLabel: projectName,
		});
	}

	private async handleCustomStudyNote(filter: { sourceNoteFilters: string[] }): Promise<void> {
		const label = filter.sourceNoteFilters.length === 1
			? filter.sourceNoteFilters[0]
			: `${filter.sourceNoteFilters.length} notes`;
		await this.plugin.openCustomStudyModal({
			sourceNoteFilters: filter.sourceNoteFilters,
			scopeLabel: label,
		});
	}

	private async handleGenerateCards(notePath: string): Promise<void> {
		await this.app.workspace.openLinkText(notePath, "", false);
		void this.plugin.activateView();
	}

	private async handleAddNoteToProject(notePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) return;

		const availableProjects = [...this.plugin.frontmatterIndex.getAllValues("projects")];
		const frontmatterService = this.plugin.flashcardManager.getFrontmatterService();
		const content = await this.app.vault.cachedRead(file);
		const currentProjects = frontmatterService.extractProjectsFromFrontmatter(content);

		const modal = new AddToProjectModal(this.app, { availableProjects, currentProjects });
		const result = await modal.openAndWait();
		if (result.cancelled || result.projects.length === 0) return;

		const newProjects = [...new Set([...currentProjects, ...result.projects])];
		await frontmatterService.setProjectsInFrontmatter(file, newProjects);

		await this.loadData();
		notify().success(`Added "${file.basename}" to project(s)`);
	}

	private async handleRemoveFromProject(notePath: string, projectName: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) return;

		const frontmatterService = this.plugin.flashcardManager.getFrontmatterService();
		const content = await this.app.vault.cachedRead(file);
		const currentProjects = frontmatterService.extractProjectsFromFrontmatter(content);
		const newProjects = currentProjects.filter((p) => p !== projectName);
		await frontmatterService.setProjectsInFrontmatter(file, newProjects);

		await this.loadData();
		notify().success(`Removed "${file.basename}" from "${projectName}"`);
	}

	private async handleAddNotesToProject(projectName: string): Promise<void> {
		const modal = new SelectNoteModal(this.app, {
			title: `Add Note to "${projectName}"`,
			excludeFlashcardFiles: true,
		});
		const result = await modal.openAndWait();
		if (result.cancelled || !result.selectedNote) return;

		const frontmatterService = this.plugin.flashcardManager.getFrontmatterService();
		const content = await this.app.vault.cachedRead(result.selectedNote);
		const currentProjects = frontmatterService.extractProjectsFromFrontmatter(content);

		if (currentProjects.includes(projectName)) {
			notify().info(`Note already in project "${projectName}"`);
			return;
		}

		const newProjects = [...currentProjects, projectName];
		await frontmatterService.setProjectsInFrontmatter(result.selectedNote, newProjects);

		let sourceUid = await frontmatterService.getSourceNoteUid(result.selectedNote);
		if (!sourceUid) {
			sourceUid = frontmatterService.generateUid();
			await frontmatterService.setSourceNoteUid(result.selectedNote, sourceUid);
		}

		await this.loadData();
		notify().success(`Added "${result.selectedNote.basename}" to "${projectName}"`);
	}

	private async handleBulkAddToProject(): Promise<void> {
		const state = this.noteHub;
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

		this.noteHub.exitSelectionMode();
		await this.loadData();
		notify().success(`Added ${selectedPaths.length} note(s) to ${result.projects.length} project(s)`);
	}

	private async handleBulkReview(): Promise<void> {
		const state = this.noteHub;
		const selectedPaths = Array.from(state.selectedNotePaths);

		if (selectedPaths.length === 0) {
			notify().warning("No notes selected");
			return;
		}

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

		this.noteHub.exitSelectionMode();
		await this.handleStartReview({ sourceNoteFilters: noteNames });
	}
}
