/**
 * Session Modal
 * Allows user to select review session type and filters
 */
import { App } from "obsidian";
import type { FSRSFlashcardItem } from "../../types";
import type { DayBoundaryService } from "../../services";
import { BaseModal } from "./BaseModal";
import { SessionLogic } from "../../logic/SessionLogic";
import { SessionHeader } from "../session";
import { SessionContent } from "../session";
import { SessionFooter } from "../session";
import { SessionResultFactory } from "../../utils/session-result-factory";

export type SessionType = "current-note" | "created-today" | "select-notes" | "state-filter" | "default";

export interface SessionResult {
	cancelled: boolean;
	sessionType: SessionType | null;
	sourceNoteFilter?: string;
	sourceNoteFilters?: string[];
	filePathFilter?: string;
	createdTodayOnly?: boolean;
	ignoreDailyLimits: boolean;
	/** Use default deck (Knowledge) with no filters */
	useDefaultDeck?: boolean;
	/** Bypass scheduling - show all matching cards regardless of due date */
	bypassScheduling?: boolean;
	/** Filter by card state (due, learning, new, buried) */
	stateFilter?: "due" | "learning" | "new" | "buried";
}

export interface SessionModalOptions {
	currentNoteName: string | null;
	allCards: FSRSFlashcardItem[];
	dayBoundaryService: DayBoundaryService;
}

/**
 * Modal for selecting review session type
 */
export class SessionModal extends BaseModal {
	private options: SessionModalOptions;
	private logic: SessionLogic;
	private resolvePromise: ((result: SessionResult) => void) | null = null;
	private hasSelected = false;

	// State
	private selectedNotes: Set<string> = new Set();
	private searchQuery = "";

	// Component references
	private headerComponent: SessionHeader | null = null;
	private contentComponent: SessionContent | null = null;
	private footerComponent: SessionFooter | null = null;

	// Container elements
	private headerContainer!: HTMLElement;
	private contentContainer!: HTMLElement;
	private footerContainer!: HTMLElement;

	constructor(app: App, options: SessionModalOptions) {
		super(app, { title: "Review Session", width: "500px" });
		this.options = options;
		this.logic = new SessionLogic(options.allCards, options.dayBoundaryService);
	}

	/**
	 * Open modal and return promise with selection result
	 */
	async openAndWait(): Promise<SessionResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-session-modal");
	}

	protected renderBody(container: HTMLElement): void {
		container.empty();

		// Create containers
		this.headerContainer = container.createDiv();
		this.contentContainer = container.createDiv();
		this.footerContainer = container.createDiv();

		// Render components
		this.renderComponents();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();

		if (!this.hasSelected && this.resolvePromise) {
			this.resolvePromise(SessionResultFactory.createCancelledResult());
			this.resolvePromise = null;
		}
	}

	private renderComponents(): void {
		const now = new Date();

		// Header
		this.headerComponent = new SessionHeader(this.headerContainer, {
			selectionCount: this.selectedNotes.size,
		});
		this.headerComponent.render();

		// Content
		this.contentComponent = new SessionContent(this.contentContainer, {
			currentNoteName: this.options.currentNoteName,
			allCards: this.options.allCards,
			selectedNotes: this.selectedNotes,
			searchQuery: this.searchQuery,
			now: now,
			logic: this.logic,
			onQuickAction: (action) => this.handleQuickAction(action),
			onNoteToggle: (note) => this.handleNoteToggle(note),
			onSearchChange: (query) => this.handleSearchChange(query),
			onSelectAll: (select) => this.handleSelectAll(select),
			onNavigateToNote: (notePath) => this.handleNavigateToNote(notePath),
		});
		this.contentComponent.render();

		// Footer
		this.footerComponent = new SessionFooter(this.footerContainer, {
			selectionCount: this.selectedNotes.size,
			onStartSession: () => this.startSelectedSession(),
			onClearSelection: () => this.clearSelection(),
		});
		this.footerComponent.render();
	}

	private updateUI(): void {
		this.renderComponents();
	}

	private handleNoteToggle(noteName: string): void {
		if (this.selectedNotes.has(noteName)) {
			this.selectedNotes.delete(noteName);
		} else {
			this.selectedNotes.add(noteName);
		}
		this.updateUI();
	}

	private handleSearchChange(query: string): void {
		this.searchQuery = query;
		this.updateUI();
	}

	private handleSelectAll(select: boolean): void {
		const now = new Date();
		const filteredStats = this.logic.getFilteredNoteStats(this.searchQuery, now);
		const availableNotes = filteredStats
			.filter((s) => s.newCount > 0 || s.dueCount > 0)
			.map((s) => s.noteName);

		if (select) {
			availableNotes.forEach((note) => this.selectedNotes.add(note));
		} else {
			this.selectedNotes.clear();
		}
		this.updateUI();
	}

	private clearSelection(): void {
		this.selectedNotes.clear();
		this.updateUI();
	}

	private handleNavigateToNote(notePath: string): void {
		void this.app.workspace.openLinkText(notePath, "", false);
	}

	private handleQuickAction(action: "current-note" | "today" | "default" | "buried"): void {
		switch (action) {
			case "current-note":
				this.selectCurrentNote();
				break;
			case "today":
				this.selectTodaysCards();
				break;
			case "default":
				this.selectDefaultDeck();
				break;
			case "buried":
				this.selectBuriedCards();
				break;
		}
	}

	private selectCurrentNote(): void {
		if (!this.options.currentNoteName) return;

		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise(SessionResultFactory.createCurrentNoteResult(this.options.currentNoteName));
			this.resolvePromise = null;
		}
		this.close();
	}

	private selectTodaysCards(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise(SessionResultFactory.createTodaysCardsResult());
			this.resolvePromise = null;
		}
		this.close();
	}

	private selectDefaultDeck(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise(SessionResultFactory.createDefaultDeckResult());
			this.resolvePromise = null;
		}
		this.close();
	}

	private selectBuriedCards(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise(SessionResultFactory.createBuriedCardsResult());
			this.resolvePromise = null;
		}
		this.close();
	}

	private startSelectedSession(): void {
		if (this.selectedNotes.size === 0) return;

		this.hasSelected = true;
		if (this.resolvePromise) {
			const noteFilters = Array.from(this.selectedNotes);
			this.resolvePromise(SessionResultFactory.createSelectedNotesResult(noteFilters));
			this.resolvePromise = null;
		}
		this.close();
	}
}
