/**
 * Session View
 * Panel-based view for session selection
 * Alternative to SessionModal
 */
import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { VIEW_TYPE_SESSION } from "../../constants";
import { getEventBus } from "../../services";
import { SessionLogic } from "../../logic/SessionLogic";
import { createSessionStateManager } from "../../state/session.state";
import type { DayBoundaryService } from "../../services";
import type { FSRSFlashcardItem } from "../../types";
import type { SessionModalOptions } from "../modals/SessionModal";
import type { SessionSelectedEvent } from "../../types/events.types";
import { SessionHeader } from "./SessionHeader";
import { SessionContent } from "./SessionContent";
import { SessionFooter } from "./SessionFooter";
import type EpistemePlugin from "../../main";
import { SessionResultFactory } from "../../utils/session-result-factory";

/**
 * Session View
 * Panel-based version of SessionModal
 */
export class SessionView extends ItemView {
	private plugin: EpistemePlugin;
	private stateManager = createSessionStateManager();
	private logic: SessionLogic | null = null;
	private dayBoundaryService: DayBoundaryService | null = null;

	// UI Components
	private headerComponent: SessionHeader | null = null;
	private contentComponent: SessionContent | null = null;
	private footerComponent: SessionFooter | null = null;

	// Container elements
	private headerContainer!: HTMLElement;
	private contentContainer!: HTMLElement;
	private footerContainer!: HTMLElement;

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
		container.addClass("episteme-session-view");

		// Create container elements
		this.headerContainer = container.createDiv({
			cls: "episteme-session-header-container",
		});
		this.contentContainer = container.createDiv({
			cls: "episteme-session-content-container",
		});
		this.footerContainer = container.createDiv({
			cls: "episteme-session-footer-container",
		});

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() => this.render());
	}

	async onClose(): Promise<void> {
		// Cleanup subscriptions
		this.unsubscribe?.();

		// Cleanup components
		this.headerComponent?.destroy();
		this.contentComponent?.destroy();
		this.footerComponent?.destroy();
	}

	/**
	 * Initialize the view with session data
	 * Called by the plugin to set up the view
	 */
	initialize(options: SessionModalOptions): void {
		// Store services
		this.dayBoundaryService = options.dayBoundaryService;

		// Create logic instance
		this.logic = new SessionLogic(
			options.allCards,
			options.dayBoundaryService
		);

		// Initialize state
		this.stateManager.initialize(
			options.currentNoteName,
			options.allCards
		);

		// Update timestamp
		this.stateManager.updateTimestamp();
	}

	/**
	 * Handle quick action button click
	 */
	private handleQuickAction(action: "current-note" | "today" | "default" | "buried"): void {
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
		const filteredStats = this.logic.getFilteredNoteStats(state.searchQuery, state.now);
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
	 * Handle start session button click
	 */
	private handleStartSession(): void {
		const state = this.stateManager.getState();
		const selectedNotes = state.selectedNotes;

		if (selectedNotes.size === 0) return;

		const result = SessionResultFactory.createSelectedNotesResult(Array.from(selectedNotes));
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
		if (!this.logic) return;

		// Preserve scroll position before re-render
		const noteList = this.contentContainer.querySelector('.episteme-note-list');
		const scrollTop = noteList?.scrollTop ?? 0;

		const state = this.stateManager.getState();
		const selectionCount = state.selectedNotes.size;

		// Render Header
		this.headerComponent?.destroy();
		this.headerContainer.empty();
		this.headerComponent = new SessionHeader(this.headerContainer, {
			selectionCount,
		});
		this.headerComponent.render();

		// Render Content
		this.contentComponent?.destroy();
		this.contentContainer.empty();
		this.contentComponent = new SessionContent(this.contentContainer, {
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
		});
		this.contentComponent.render();

		// Render Footer
		this.footerComponent?.destroy();
		this.footerContainer.empty();
		this.footerComponent = new SessionFooter(this.footerContainer, {
			selectionCount,
			onStartSession: () => this.handleStartSession(),
			onClearSelection: () => this.handleClearSelection(),
		});
		this.footerComponent.render();

		// Restore scroll position after re-render
		const newNoteList = this.contentContainer.querySelector('.episteme-note-list');
		if (newNoteList) {
			newNoteList.scrollTop = scrollTop;
		}
	}
}
