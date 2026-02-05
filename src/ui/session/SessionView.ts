/**
 * Session View
 * Panel-based view for session selection
 */
import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_SESSION } from "../../constants";
import { getEventBus, notify } from "../../services";
import { SessionLogic } from "./SessionLogic";
import type { DayBoundaryService } from "../../services";
import type { SessionSelectedEvent } from "../../types/events.types";
import type { FSRSFlashcardItem } from "../../types";
import { Panel } from "../components/Panel";
import { SessionContent } from "./SessionContent";
import type TrueRecallPlugin from "../../main";
import { SessionResultFactory } from "../../utils/session-result-factory";
import { MoveCardModal } from "../modals/MoveCardModal";
import { AddToProjectModal } from "../modals/AddToProjectModal";
import type { SessionApi } from "../../state/store";

export interface SessionViewOptions {
	currentNoteName: string | null;
	allCards: FSRSFlashcardItem[];
	dayBoundaryService: DayBoundaryService;
}

export class SessionView extends ItemView {
	private plugin: TrueRecallPlugin;
	private logic: SessionLogic | null = null;
	private dayBoundaryService: DayBoundaryService | null = null;

	// UI Components
	private panelComponent: Panel | null = null;
	private contentComponent: SessionContent | null = null;
	private selectionBarEl: HTMLElement | null = null;

	// Native header action elements
	private startSessionAction: HTMLElement | null = null;
	private clearSelectionAction: HTMLElement | null = null;
	private moveAction: HTMLElement | null = null;
	private addToProjectAction: HTMLElement | null = null;

	// State subscription
	private unsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	private get session(): SessionApi {
		return this.plugin.store!.getState().session;
	}

	getViewType(): string {
		return VIEW_TYPE_SESSION;
	}

	getDisplayText(): string {
		return "Session";
	}

	getIcon(): string {
		return "list-filter";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();

		// Ensure container fills available space (mobile padding handled by global CSS)
		container.addClass("ep:h-full", "ep:flex", "ep:flex-col");

		this.panelComponent = new Panel(container, {
			disableScroll: true,
		});
		this.panelComponent.render();

		// Subscribe to state changes - update render, header actions, and title
		this.unsubscribe = this.plugin.store!.subscribe(
			(state) => state.session,
			() => {
				this.render();
				this.updateHeaderActions();
				this.updateTitle();
			}
		);
	}

	/**
	 * Update native header actions based on selection state
	 */
	private updateHeaderActions(): void {
		const state = this.session;
		const selectionCount = state.selectedNotes.size;

		if (this.clearSelectionAction) {
			this.clearSelectionAction.remove();
			this.clearSelectionAction = null;
		}
		if (this.startSessionAction) {
			this.startSessionAction.remove();
			this.startSessionAction = null;
		}
		if (this.moveAction) {
			this.moveAction.remove();
			this.moveAction = null;
		}
		if (this.addToProjectAction) {
			this.addToProjectAction.remove();
			this.addToProjectAction = null;
		}

		if (selectionCount > 0) {
			this.startSessionAction = this.addAction(
				"play",
				"Start session",
				() => this.handleStartSession()
			);

			this.moveAction = this.addAction(
				"folder-input",
				"Move flashcards",
				() => void this.handleMoveSelectedNotes()
			);

			this.addToProjectAction = this.addAction(
				"folder-plus",
				"Add to project",
				() => void this.handleAddToProject()
			);

			this.clearSelectionAction = this.addAction(
				"x-circle",
				"Clear selection",
				() => this.handleClearSelection()
			);
		}
	}

	/**
	 * Update native header title to show selection count
	 */
	private updateTitle(): void {
		const state = this.session;
		const selectionCount = state.selectedNotes.size;

		// Access title element in view header
		const titleEl = this.containerEl.querySelector(".view-header-title");
		if (titleEl) {
			titleEl.textContent =
				selectionCount > 0 ? `Session (${selectionCount})` : "Session";
		}
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();

		if (this.clearSelectionAction) {
			this.clearSelectionAction.remove();
			this.clearSelectionAction = null;
		}
		if (this.startSessionAction) {
			this.startSessionAction.remove();
			this.startSessionAction = null;
		}
		if (this.moveAction) {
			this.moveAction.remove();
			this.moveAction = null;
		}
		if (this.addToProjectAction) {
			this.addToProjectAction.remove();
			this.addToProjectAction = null;
		}

		if (this.selectionBarEl) {
			this.selectionBarEl.remove();
			this.selectionBarEl = null;
		}

		this.panelComponent?.destroy();
		this.contentComponent?.destroy();
	}

	/**
	 * Initialize the view with session data
	 * Called by the plugin to set up the view
	 */
	initialize(options: SessionViewOptions): void {
		// Store services
		this.dayBoundaryService = options.dayBoundaryService;
		this.logic = new SessionLogic(
			options.allCards,
			options.dayBoundaryService
		);
		this.session.initialize(options.currentNoteName, options.allCards);
		this.session.updateTimestamp();
	}

	private handleQuickAction(
		action: "current-note" | "today" | "default" | "buried"
	): void {
		const result = SessionResultFactory.createActionResult(
			action,
			this.session.currentNoteName
		);
		this.emitResultAndClose(result);
	}

	private handleNoteToggle(noteName: string): void {
		this.session.toggleNoteSelection(noteName);
	}

	private handleSearchChange(query: string): void {
		this.session.setSearchQuery(query);
	}

	private handleSelectAll(select: boolean): void {
		if (!this.logic) return;

		const state = this.session;
		const filteredStats = this.logic.getFilteredNoteStats(
			state.searchQuery,
			state.now
		);
		const availableNotes = filteredStats
			.filter((s) => s.newCount > 0 || s.dueCount > 0)
			.map((s) => s.noteName);

		this.session.setAllNotesSelected(availableNotes, select);
	}

	private handleClearSelection(): void {
		this.session.clearSelection();
	}

	private handleNavigateToNote(notePath: string): void {
		void this.app.workspace.openLinkText(notePath, "", false);
	}

	private handleStartSession(): void {
		const state = this.session;
		const selectedNotes = state.selectedNotes;

		if (selectedNotes.size === 0) return;

		const result = SessionResultFactory.createSelectedNotesResult(
			Array.from(selectedNotes)
		);
		this.emitResultAndClose(result);
	}

	private async handleMoveSelectedNotes(): Promise<void> {
		const state = this.session;
		const selectedNotes = state.selectedNotes;
		if (selectedNotes.size === 0) return;

		const allCards = state.allCards;
		const cardsToMove = allCards.filter(
			(card) =>
				card.sourceNoteName && selectedNotes.has(card.sourceNoteName)
		);

		if (cardsToMove.length === 0) {
			notify().warning("No flashcards found in selected notes");
			return;
		}

		// Open MoveCardModal
		const modal = new MoveCardModal(this.app, {
			cardCount: cardsToMove.length,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		// Move all cards to target note
		let movedCount = 0;
		for (const card of cardsToMove) {
			const success = await this.plugin.flashcardManager.moveCard(
				card.id,
				result.targetNotePath
			);
			if (success) movedCount++;
		}

		notify().cardsMoved(movedCount, result.targetNotePath);

		// Clear selection
		this.session.clearSelection();
	}

	/**
	 * Handle add to project - adds selected notes to project(s)
	 */
	private async handleAddToProject(): Promise<void> {
		const state = this.session;
		const selectedNotes = state.selectedNotes;
		if (selectedNotes.size === 0) return;

		// Get available projects from frontmatter index
		const availableProjects = Array.from(
			this.plugin.frontmatterIndex.getAllValues("projects")
		);

		// Open AddToProjectModal
		const modal = new AddToProjectModal(this.app, {
			availableProjects,
			currentProjects: [], // Empty - we're adding to multiple notes
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.projects.length === 0) return;

		// Apply projects to all selected notes
		const frontmatterService =
			this.plugin.flashcardManager.getFrontmatterService();
		let updatedCount = 0;

		for (const noteName of selectedNotes) {
			// Find note file by name
			const noteFile = this.app.vault
				.getMarkdownFiles()
				.find((f) => f.basename === noteName);
			if (!noteFile) continue;

				const content = await this.app.vault.cachedRead(noteFile);
			const currentProjects =
				frontmatterService.extractProjectsFromFrontmatter(content);
			const newProjects = [
				...new Set([...currentProjects, ...result.projects]),
			];

			await frontmatterService.setProjectsInFrontmatter(
				noteFile,
				newProjects
			);
			updatedCount++;
		}

		notify().success(`Added ${updatedCount} note(s) to project(s)`);

		this.session.clearSelection();
	}

	private emitResultAndClose(result: SessionSelectedEvent["result"]): void {
		const eventBus = getEventBus();

		const event: SessionSelectedEvent = {
			type: "session:selected",
			result,
			timestamp: Date.now(),
		};

		eventBus.emit(event);

		// Close the panel view
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION);
		for (const leaf of leaves) {
			leaf.detach();
		}
	}

	private render(): void {
		if (!this.logic || !this.panelComponent) return;

		const contentContainer = this.panelComponent.getContentContainer();

		// Preserve scroll position before re-render
		const scrollWrapper = contentContainer.querySelector(".true-recall-session-scroll");
		const scrollTop = scrollWrapper?.scrollTop ?? 0;

		const state = this.session;

		this.contentComponent?.destroy();
		contentContainer.empty();
		this.contentComponent = new SessionContent(contentContainer, {
			currentNoteName: state.currentNoteName,
			allCards: state.allCards,
			selectedNotes: state.selectedNotes,
			searchQuery: state.searchQuery,
			now: state.now,
			logic: this.logic,
			onQuickAction: (action) => this.handleQuickAction(action),
			onNoteToggle: (note) => this.handleNoteToggle(note),
			onSearchChange: (query) => this.handleSearchChange(query),
			onSelectAll: (select) => this.handleSelectAll(select),
			onNavigateToNote: (notePath) => this.handleNavigateToNote(notePath),
		});
		this.contentComponent.render();

		// Restore scroll position after re-render
		const newScrollWrapper = contentContainer.querySelector(
			".true-recall-session-scroll"
		);
		if (newScrollWrapper) {
			newScrollWrapper.scrollTop = scrollTop;
		}

		// Add/remove class based on search query content (for mobile CSS)
		const panelEl = this.panelComponent.getElement();
		if (state.searchQuery.length > 0) {
			panelEl?.addClass("true-recall-has-search-query");
		} else {
			panelEl?.removeClass("true-recall-has-search-query");
		}

		this.renderSelectionBar();
	}

	private renderSelectionBar(): void {
		const state = this.session;
		const selectionCount = state.selectedNotes.size;

		if (this.selectionBarEl) {
			this.selectionBarEl.remove();
			this.selectionBarEl = null;
		}

		// Only show when notes are selected
		if (selectionCount === 0) return;

		const contentContainer = this.panelComponent?.getContentContainer();
		if (!contentContainer) return;

		const sessionContentEl = contentContainer.querySelector(".true-recall-session-content");
		if (!sessionContentEl) return;

		// Hidden on mobile - use header actions instead
		this.selectionBarEl = sessionContentEl.createDiv({
			cls: "true-recall-session-selection-bar ep:hidden ep:md:flex ep:items-center ep:justify-between ep:p-3 ep:mt-2 ep:bg-obs-secondary ep:rounded-md ep:gap-3 ep:shrink-0",
		});

		this.selectionBarEl.createSpan({
			cls: "ep:text-ui-small ep:text-obs-muted ep:font-medium",
			text: `${selectionCount} note${
				selectionCount > 1 ? "s" : ""
			} selected`,
		});

		const buttons = this.selectionBarEl.createDiv({
			cls: "ep:flex ep:gap-2",
		});

		const moveBtn = buttons.createEl("button", {
			cls: "ep:py-1.5 ep:px-3 ep:text-ui-small ep:bg-obs-border ep:text-obs-normal ep:border-none ep:rounded ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
			text: "Move",
		});
		// Use registerDomEvent for automatic cleanup on view close
		this.registerDomEvent(moveBtn, "click", () =>
			void this.handleMoveSelectedNotes()
		);

		const addProjectBtn = buttons.createEl("button", {
			cls: "ep:py-1.5 ep:px-3 ep:text-ui-small ep:bg-obs-border ep:text-obs-normal ep:border-none ep:rounded ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
			text: "Add to project",
		});
		this.registerDomEvent(addProjectBtn, "click", () =>
			void this.handleAddToProject()
		);

		const clearBtn = buttons.createEl("button", {
			cls: "ep:py-1.5 ep:px-3 ep:text-ui-small ep:bg-obs-border ep:text-obs-normal ep:border-none ep:rounded ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
			text: "Clear",
		});
		this.registerDomEvent(clearBtn, "click", () => this.handleClearSelection());

		const startBtn = buttons.createEl("button", {
			cls: "mod-cta ep:py-1.5 ep:px-4 ep:text-ui-small",
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: "Start Session",
		});
		this.registerDomEvent(startBtn, "click", () => this.handleStartSession());
	}
}
