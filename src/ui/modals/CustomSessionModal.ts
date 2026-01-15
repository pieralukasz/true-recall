/**
 * Custom Session Modal
 * Allows user to select custom review session type and filters
 */
import { App } from "obsidian";
import type { FSRSFlashcardItem } from "../../types";
import type { DayBoundaryService } from "../../services";
import { BaseModal } from "./BaseModal";
import { CustomSessionLogic } from "../../logic/CustomSessionLogic";
import { CustomSessionHeader } from "../custom-session";
import { CustomSessionContent } from "../custom-session";
import { CustomSessionFooter } from "../custom-session";
import { CustomSessionResultFactory } from "../../utils/custom-session-result-factory";

export type CustomSessionType = "current-note" | "created-today" | "select-notes" | "state-filter" | "default";

export interface CustomSessionResult {
	cancelled: boolean;
	sessionType: CustomSessionType | null;
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

export interface CustomSessionModalOptions {
	currentNoteName: string | null;
	allCards: FSRSFlashcardItem[];
	dayBoundaryService: DayBoundaryService;
}

/**
 * Modal for selecting custom review session type
 */
export class CustomSessionModal extends BaseModal {
	private options: CustomSessionModalOptions;
	private logic: CustomSessionLogic;
	private resolvePromise: ((result: CustomSessionResult) => void) | null = null;
	private hasSelected = false;

	// State
	private selectedNotes: Set<string> = new Set();
	private searchQuery = "";

	// Component references
	private headerComponent: CustomSessionHeader | null = null;
	private contentComponent: CustomSessionContent | null = null;
	private footerComponent: CustomSessionFooter | null = null;

	// Container elements
	private headerContainer!: HTMLElement;
	private contentContainer!: HTMLElement;
	private footerContainer!: HTMLElement;

	constructor(app: App, options: CustomSessionModalOptions) {
		super(app, { title: "Review Session", width: "500px" });
		this.options = options;
		this.logic = new CustomSessionLogic(options.allCards, options.dayBoundaryService);
	}

	/**
	 * Open modal and return promise with selection result
	 */
	async openAndWait(): Promise<CustomSessionResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-custom-session-modal");
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
			this.resolvePromise(CustomSessionResultFactory.createCancelledResult());
			this.resolvePromise = null;
		}
	}

	private renderComponents(): void {
		const now = new Date();

		// Header
		this.headerComponent = new CustomSessionHeader(this.headerContainer, {
			selectionCount: this.selectedNotes.size,
		});
		this.headerComponent.render();

		// Content
		this.contentComponent = new CustomSessionContent(this.contentContainer, {
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
		});
		this.contentComponent.render();

		// Footer
		this.footerComponent = new CustomSessionFooter(this.footerContainer, {
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
			this.resolvePromise(CustomSessionResultFactory.createCurrentNoteResult(this.options.currentNoteName));
			this.resolvePromise = null;
		}
		this.close();
	}

	private selectTodaysCards(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise(CustomSessionResultFactory.createTodaysCardsResult());
			this.resolvePromise = null;
		}
		this.close();
	}

	private selectDefaultDeck(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise(CustomSessionResultFactory.createDefaultDeckResult());
			this.resolvePromise = null;
		}
		this.close();
	}

	private selectBuriedCards(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise(CustomSessionResultFactory.createBuriedCardsResult());
			this.resolvePromise = null;
		}
		this.close();
	}

	private startSelectedSession(): void {
		if (this.selectedNotes.size === 0) return;

		this.hasSelected = true;
		if (this.resolvePromise) {
			const noteFilters = Array.from(this.selectedNotes);
			this.resolvePromise(CustomSessionResultFactory.createSelectedNotesResult(noteFilters));
			this.resolvePromise = null;
		}
		this.close();
	}
}
