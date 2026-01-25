/**
 * Session View
 * Panel-based view for session selection
 */
import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_SESSION } from "../../constants";
import { getEventBus } from "../../services";
import { SessionLogic } from "./SessionLogic";
import { createSessionStateManager } from "../../state/session.state";
import type { DayBoundaryService } from "../../services";
import type { SessionSelectedEvent } from "../../types/events.types";
import type { FSRSFlashcardItem } from "../../types";
import { Panel } from "../components/Panel";
import { SessionContent } from "./SessionContent";
import type EpistemePlugin from "../../main";
import { SessionResultFactory } from "../../utils/session-result-factory";

/**
 * Options for initializing SessionView
 */
export interface SessionViewOptions {
	currentNoteName: string | null;
	allCards: FSRSFlashcardItem[];
	dayBoundaryService: DayBoundaryService;
}

/**
 * Session View
 * Panel-based view for session selection
 */
export class SessionView extends ItemView {
	private plugin: EpistemePlugin;
	private stateManager = createSessionStateManager();
	private logic: SessionLogic | null = null;
	private dayBoundaryService: DayBoundaryService | null = null;

	// UI Components
	private panelComponent: Panel | null = null;
	private contentComponent: SessionContent | null = null;
	private selectionBarEl: HTMLElement | null = null;

	// Native header action elements
	private startSessionAction: HTMLElement | null = null;
	private clearSelectionAction: HTMLElement | null = null;

	// State subscription
	private unsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
		super(leaf);
		this.plugin = plugin;
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

		// Create Panel component (header is native Obsidian header)
		this.panelComponent = new Panel(container, {
			disableScroll: true,
		});
		this.panelComponent.render();

		// Subscribe to state changes - update render, header actions, and title
		this.unsubscribe = this.stateManager.subscribe(() => {
			this.render();
			this.updateHeaderActions();
			this.updateTitle();
		});
	}

	/**
	 * Update native header actions based on selection state
	 */
	private updateHeaderActions(): void {
		const state = this.stateManager.getState();
		const selectionCount = state.selectedNotes.size;

		// Remove existing actions
		if (this.clearSelectionAction) {
			this.clearSelectionAction.remove();
			this.clearSelectionAction = null;
		}
		if (this.startSessionAction) {
			this.startSessionAction.remove();
			this.startSessionAction = null;
		}

		// Add actions when notes are selected
		if (selectionCount > 0) {
			// Start session button (play icon)
			this.startSessionAction = this.addAction(
				"play",
				"Start session",
				() => this.handleStartSession()
			);

			// Clear selection button
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
		const state = this.stateManager.getState();
		const selectionCount = state.selectedNotes.size;

		// Access title element in view header
		const titleEl = this.containerEl.querySelector(".view-header-title");
		if (titleEl) {
			titleEl.textContent =
				selectionCount > 0 ? `Session (${selectionCount})` : "Session";
		}
	}

	async onClose(): Promise<void> {
		// Cleanup subscriptions
		this.unsubscribe?.();

		// Remove native header actions
		if (this.clearSelectionAction) {
			this.clearSelectionAction.remove();
			this.clearSelectionAction = null;
		}
		if (this.startSessionAction) {
			this.startSessionAction.remove();
			this.startSessionAction = null;
		}

		// Cleanup selection bar
		if (this.selectionBarEl) {
			this.selectionBarEl.remove();
			this.selectionBarEl = null;
		}

		// Cleanup components
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

		// Create logic instance
		this.logic = new SessionLogic(
			options.allCards,
			options.dayBoundaryService
		);

		// Initialize state
		this.stateManager.initialize(options.currentNoteName, options.allCards);

		// Update timestamp
		this.stateManager.updateTimestamp();
	}

	/**
	 * Handle quick action button click
	 */
	private handleQuickAction(
		action: "current-note" | "today" | "default" | "buried"
	): void {
		const result = SessionResultFactory.createActionResult(
			action,
			this.stateManager.getState().currentNoteName
		);
		this.emitResultAndClose(result);
	}

	/**
	 * Handle note selection toggle
	 */
	private handleNoteToggle(noteName: string): void {
		this.stateManager.toggleNoteSelection(noteName);
	}

	/**
	 * Handle search query change
	 */
	private handleSearchChange(query: string): void {
		this.stateManager.setSearchQuery(query);
	}

	/**
	 * Handle select all toggle
	 */
	private handleSelectAll(select: boolean): void {
		if (!this.logic) return;

		const state = this.stateManager.getState();
		const filteredStats = this.logic.getFilteredNoteStats(
			state.searchQuery,
			state.now
		);
		const availableNotes = filteredStats
			.filter((s) => s.newCount > 0 || s.dueCount > 0)
			.map((s) => s.noteName);

		this.stateManager.setAllNotesSelected(availableNotes, select);
	}

	/**
	 * Handle clear selection
	 */
	private handleClearSelection(): void {
		this.stateManager.clearSelection();
	}

	/**
	 * Handle navigation to a note
	 */
	private handleNavigateToNote(notePath: string): void {
		void this.app.workspace.openLinkText(notePath, "", false);
	}

	/**
	 * Handle start session button click
	 */
	private handleStartSession(): void {
		const state = this.stateManager.getState();
		const selectedNotes = state.selectedNotes;

		if (selectedNotes.size === 0) return;

		const result = SessionResultFactory.createSelectedNotesResult(
			Array.from(selectedNotes)
		);
		this.emitResultAndClose(result);
	}

	/**
	 * Emit result event and close the view
	 */
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

	/**
	 * Render all components
	 */
	private render(): void {
		if (!this.logic || !this.panelComponent) return;

		const contentContainer = this.panelComponent.getContentContainer();

		// Preserve scroll position before re-render
		const noteList = contentContainer.querySelector(".episteme-note-list");
		const scrollTop = noteList?.scrollTop ?? 0;

		const state = this.stateManager.getState();

		// Render Content
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
		const newNoteList = contentContainer.querySelector(
			".episteme-note-list"
		);
		if (newNoteList) {
			newNoteList.scrollTop = scrollTop;
		}

		// Add/remove class based on search query content (for mobile CSS)
		const panelEl = this.panelComponent.getElement();
		if (state.searchQuery.length > 0) {
			panelEl?.addClass("episteme-has-search-query");
		} else {
			panelEl?.removeClass("episteme-has-search-query");
		}

		// Render selection bar (desktop only - hidden on mobile via responsive classes)
		this.renderSelectionBar();
	}

	/**
	 * Render selection bar at bottom of content (desktop only)
	 */
	private renderSelectionBar(): void {
		const state = this.stateManager.getState();
		const selectionCount = state.selectedNotes.size;

		// Remove existing bar
		if (this.selectionBarEl) {
			this.selectionBarEl.remove();
			this.selectionBarEl = null;
		}

		// Only show when notes are selected
		if (selectionCount === 0) return;

		const contentContainer = this.panelComponent?.getContentContainer();
		if (!contentContainer) return;

		// Find SessionContent element and add selection bar at the end
		const sessionContentEl = contentContainer.querySelector(".episteme-session-content");
		if (!sessionContentEl) return;

		// Create selection bar at bottom of SessionContent (hidden on mobile - use header actions instead)
		this.selectionBarEl = sessionContentEl.createDiv({
			cls: "episteme-session-selection-bar ep:hidden ep:md:flex ep:items-center ep:justify-between ep:p-3 ep:mt-2 ep:bg-obs-secondary ep:rounded-md ep:gap-3 ep:shrink-0",
		});

		// Selection count text
		this.selectionBarEl.createSpan({
			cls: "ep:text-sm ep:text-obs-muted ep:font-medium",
			text: `${selectionCount} note${
				selectionCount > 1 ? "s" : ""
			} selected`,
		});

		// Button container
		const buttons = this.selectionBarEl.createDiv({
			cls: "ep:flex ep:gap-2",
		});

		// Clear button
		const clearBtn = buttons.createEl("button", {
			cls: "ep:py-1.5 ep:px-3 ep:text-sm ep:bg-obs-border ep:text-obs-normal ep:border-none ep:rounded ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
			text: "Clear",
		});
		clearBtn.addEventListener("click", () => this.handleClearSelection());

		// Start button
		const startBtn = buttons.createEl("button", {
			cls: "mod-cta ep:py-1.5 ep:px-4 ep:text-sm",
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: "Start Session",
		});
		startBtn.addEventListener("click", () => this.handleStartSession());
	}
}
