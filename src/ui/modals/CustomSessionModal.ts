/**
 * Custom Session Modal
 * Allows user to select custom review session type and filters
 */
import { App } from "obsidian";
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "../../types";
import type { DayBoundaryService } from "../../services";
import { BaseModal } from "./BaseModal";

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

interface NoteStats {
	noteName: string;
	total: number;
	newCount: number;
	dueCount: number;
	isCompleted: boolean;
}

/**
 * Modal for selecting custom review session type
 */
export class CustomSessionModal extends BaseModal {
	private options: CustomSessionModalOptions;
	private resolvePromise: ((result: CustomSessionResult) => void) | null = null;
	private hasSelected = false;

	// Multi-select state
	private selectedNotes: Set<string> = new Set();
	private searchQuery = "";
	private noteListEl: HTMLElement | null = null;
	private startButtonEl: HTMLButtonElement | null = null;

	constructor(app: App, options: CustomSessionModalOptions) {
		super(app, { title: "Review Session", width: "500px" });
		this.options = options;
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
		// Quick actions section
		this.renderQuickActions(container);

		// Divider
		container.createEl("hr", { cls: "episteme-modal-divider" });

		// Notes section header
		container.createEl("h3", { text: "Or select notes to review:" });

		// Search input
		this.renderSearchInput(container);

		// Note table
		this.noteListEl = container.createDiv({ cls: "episteme-note-list" });
		this.renderNoteTable();

		// Start button
		this.renderStartButton(container);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();

		if (!this.hasSelected && this.resolvePromise) {
			this.resolvePromise({
				cancelled: true,
				sessionType: null,
				ignoreDailyLimits: false,
			});
			this.resolvePromise = null;
		}
	}

	private renderQuickActions(container: HTMLElement): void {
		const quickActionsEl = container.createDiv({ cls: "episteme-quick-actions" });

		const now = new Date();
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		// Active Note button (current note)
		const currentNoteStats = this.getCurrentNoteStats(now);
		const activeNoteBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn",
		});
		activeNoteBtn.createSpan({ text: "Active note" });
		if (currentNoteStats && currentNoteStats.total > 0) {
			activeNoteBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: this.formatStats(currentNoteStats.newCount, currentNoteStats.dueCount),
			});
			activeNoteBtn.addEventListener("click", () => this.selectCurrentNote());
		} else {
			activeNoteBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: currentNoteStats ? "done" : "no cards",
			});
			activeNoteBtn.disabled = true;
			activeNoteBtn.addClass("episteme-btn-disabled");
		}

		// Stats
		const todayStats = this.getTodayStats(now, todayStart);

		// Today button
		const todayBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn",
		});
		todayBtn.createSpan({ text: "Today" });
		if (todayStats.total > 0) {
			todayBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: this.formatStats(todayStats.newCount, todayStats.dueCount),
			});
			todayBtn.addEventListener("click", () => this.selectTodaysCards());
		} else {
			todayBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "no cards",
			});
			todayBtn.disabled = true;
			todayBtn.addClass("episteme-btn-disabled");
		}

		// Default button (Knowledge deck, no filters)
		const defaultBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn episteme-default-btn",
		});
		defaultBtn.createSpan({ text: "Default" });
		const allCardsStats = this.getAllCardsStats(now);
		if (allCardsStats.total > 0) {
			defaultBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: this.formatStats(allCardsStats.newCount, allCardsStats.dueCount),
			});
			defaultBtn.addEventListener("click", () => this.selectDefaultDeck());
		} else {
			defaultBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "no cards",
			});
			defaultBtn.disabled = true;
			defaultBtn.addClass("episteme-btn-disabled");
		}

		// Buried cards button
		const buriedBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn",
		});
		buriedBtn.createSpan({ text: "Buried" });
		const buriedStats = this.getBuriedCardsStats(now);
		if (buriedStats.total > 0) {
			buriedBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: this.formatStats(buriedStats.newCount, buriedStats.dueCount),
			});
			buriedBtn.addEventListener("click", () => this.selectBuriedCards());
		} else {
			buriedBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "none",
			});
			buriedBtn.disabled = true;
			buriedBtn.addClass("episteme-btn-disabled");
		}
	}

	private renderSearchInput(container: HTMLElement): void {
		const searchContainer = container.createDiv({ cls: "episteme-search-container" });
		const searchInput = searchContainer.createEl("input", {
			cls: "episteme-search-input",
			type: "text",
			placeholder: "Search notes...",
		});

		searchInput.addEventListener("input", (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this.renderNoteTable();
		});
	}

	private renderNoteTable(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		const allNoteStats = this.getAllNoteStats();

		// Filter by search query and exclude notes with no available cards
		const filteredStats = allNoteStats.filter((stat) =>
			stat.noteName.toLowerCase().includes(this.searchQuery) &&
			(stat.newCount > 0 || stat.dueCount > 0)
		);

		// Sort: notes with cards first, then completed, alphabetically within groups
		filteredStats.sort((a, b) => {
			// Notes with available cards first
			const aHasCards = a.newCount > 0 || a.dueCount > 0;
			const bHasCards = b.newCount > 0 || b.dueCount > 0;
			if (aHasCards && !bHasCards) return -1;
			if (!aHasCards && bHasCards) return 1;

			// Completed last
			if (a.isCompleted && !b.isCompleted) return 1;
			if (!a.isCompleted && b.isCompleted) return -1;

			// Alphabetical
			return a.noteName.localeCompare(b.noteName);
		});

		if (filteredStats.length === 0) {
			this.noteListEl.createDiv({
				cls: "episteme-note-list-empty",
				text: this.searchQuery ? "No notes match your search" : "No notes with flashcards found",
			});
			return;
		}

		// Create table
		const table = this.noteListEl.createEl("table", { cls: "episteme-note-table" });

		// Header
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");

		// Select all checkbox
		const selectAllTh = headerRow.createEl("th", { cls: "episteme-note-checkbox-col" });
		const selectAllCheckbox = selectAllTh.createEl("input", { type: "checkbox" });
		selectAllCheckbox.addEventListener("change", () => {
			if (selectAllCheckbox.checked) {
				// Select all visible notes with available cards
				filteredStats.forEach((stat) => {
					if (stat.newCount > 0 || stat.dueCount > 0) {
						this.selectedNotes.add(stat.noteName);
					}
				});
			} else {
				this.selectedNotes.clear();
			}
			this.renderNoteTable();
			this.updateStartButton();
		});

		headerRow.createEl("th", { text: "Note", cls: "episteme-note-name-col" });
		headerRow.createEl("th", { text: "Cards", cls: "episteme-note-stats-col" });

		// Body
		const tbody = table.createEl("tbody");

		for (const stat of filteredStats) {
			const row = tbody.createEl("tr", {
				cls: stat.isCompleted ? "episteme-note-row episteme-note-row--completed" : "episteme-note-row",
			});

			// Checkbox cell
			const checkboxTd = row.createEl("td", { cls: "episteme-note-checkbox-col" });
			const hasCards = stat.newCount > 0 || stat.dueCount > 0;

			if (hasCards) {
				const checkbox = checkboxTd.createEl("input", { type: "checkbox" });
				checkbox.checked = this.selectedNotes.has(stat.noteName);
				checkbox.addEventListener("change", () => {
					if (checkbox.checked) {
						this.selectedNotes.add(stat.noteName);
					} else {
						this.selectedNotes.delete(stat.noteName);
					}
					this.updateStartButton();
		});
 
		// Make whole row clickable
		row.addEventListener("click", (e) => {
			const target = e.target;
			if (target instanceof HTMLElement && target.tagName !== "INPUT") {
				checkbox.checked = !checkbox.checked;
				if (checkbox.checked) {
					this.selectedNotes.add(stat.noteName);
				} else {
					this.selectedNotes.delete(stat.noteName);
				}
				this.updateStartButton();
			}
		});
				row.addClass("episteme-note-row--clickable");
			} else if (stat.isCompleted) {
				// Show tick in checkbox column for completed notes
				checkboxTd.createSpan({
					cls: "episteme-completed-tick",
					text: "\u2713",
				});
			}

			// Note name cell
			row.createEl("td", {
				text: stat.noteName,
				cls: "episteme-note-name-col",
			});

			// Stats cell
			const statsTd = row.createEl("td", { cls: "episteme-note-stats-col" });
			if (stat.newCount > 0 || stat.dueCount > 0) {
				statsTd.createSpan({
					cls: "episteme-note-stats-text",
					text: this.formatStats(stat.newCount, stat.dueCount),
				});
			} else {
				statsTd.createSpan({
					cls: "episteme-stat-muted",
					text: "done",
				});
			}
		}

		// Update select all checkbox state
		const availableNotes = filteredStats.filter((s) => s.newCount > 0 || s.dueCount > 0);
		const allSelected = availableNotes.length > 0 && availableNotes.every((s) => this.selectedNotes.has(s.noteName));
		selectAllCheckbox.checked = allSelected;
		selectAllCheckbox.indeterminate = !allSelected && availableNotes.some((s) => this.selectedNotes.has(s.noteName));
	}

	private renderStartButton(container: HTMLElement): void {
		const buttonContainer = container.createDiv({ cls: "episteme-start-button-container" });
		this.startButtonEl = buttonContainer.createEl("button", {
			cls: "mod-cta episteme-start-session-btn",
			text: "Start session",
		});
		this.startButtonEl.disabled = true;
		this.startButtonEl.addEventListener("click", () => this.startSelectedSession());
		this.updateStartButton();
	}

	private updateStartButton(): void {
		if (!this.startButtonEl) return;

		const count = this.selectedNotes.size;
		if (count === 0) {
			this.startButtonEl.disabled = true;
			this.startButtonEl.textContent = "Select notes to start";
		} else {
			this.startButtonEl.disabled = false;
			this.startButtonEl.textContent = count === 1
				? "Start session (1 note)"
				: `Start session (${count} notes)`;
		}
	}

	private formatStats(newCount: number, dueCount: number): string {
		const parts: string[] = [];
		if (newCount > 0) parts.push(`${newCount} new`);
		if (dueCount > 0) parts.push(`${dueCount} due`);
		return parts.join(" \u00b7 ") || "no cards";
	}

	private getTodayStats(now: Date, todayStart: Date): { total: number; newCount: number; dueCount: number } {
		const cards = this.options.allCards.filter((c) => {
			const createdAt = c.fsrs.createdAt;
			return createdAt && createdAt >= todayStart.getTime() && this.isCardAvailable(c, now) && !c.fsrs.suspended && !this.isCardBuried(c, now);
		});

		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	private getAllNoteStats(): NoteStats[] {
		const now = new Date();
		const noteMap = new Map<string, FSRSFlashcardItem[]>();

		// Group cards by source note
		for (const card of this.options.allCards) {
			if (!card.sourceNoteName) continue;
			const existing = noteMap.get(card.sourceNoteName) || [];
			existing.push(card);
			noteMap.set(card.sourceNoteName, existing);
		}

		const stats: NoteStats[] = [];

		for (const [noteName, cards] of noteMap) {
			const availableCards = cards.filter((c) => this.isCardAvailable(c, now) && !c.fsrs.suspended && !this.isCardBuried(c, now));
			const newCount = availableCards.filter((c) => c.fsrs.state === State.New).length;
			const dueCount = availableCards.filter((c) => c.fsrs.state !== State.New).length;

			// Check if completed (no new cards remaining for this note)
			const allNewCards = cards.filter((c) => c.fsrs.state === State.New);
			const isCompleted = allNewCards.length === 0 && cards.length > 0;

			stats.push({
				noteName,
				total: availableCards.length,
				newCount,
				dueCount,
				isCompleted,
			});
		}

		return stats;
	}

	private isCardAvailable(card: FSRSFlashcardItem, now: Date): boolean {
		return this.options.dayBoundaryService.isCardAvailable(card, now);
	}

	private isCardBuried(card: FSRSFlashcardItem, now: Date): boolean {
		if (!card.fsrs.buriedUntil) return false;
		return new Date(card.fsrs.buriedUntil) > now;
	}

	private getBuriedCardsStats(now: Date): { total: number; newCount: number; dueCount: number } {
		const cards = this.options.allCards.filter((c) => {
			if (!c.fsrs.buriedUntil) return false;
			return new Date(c.fsrs.buriedUntil) > now;
		});

		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	private getCurrentNoteStats(now: Date): { total: number; newCount: number; dueCount: number } | null {
		if (!this.options.currentNoteName) return null;

		const cards = this.options.allCards.filter(
			(c) => c.sourceNoteName === this.options.currentNoteName && this.isCardAvailable(c, now) && !c.fsrs.suspended && !this.isCardBuried(c, now)
		);

		if (cards.length === 0) return null;

		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	private selectCurrentNote(): void {
		if (!this.options.currentNoteName) return;

		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				sessionType: "current-note",
				sourceNoteFilter: this.options.currentNoteName,
				ignoreDailyLimits: true,
			});
			this.resolvePromise = null;
		}
		this.close();
	}

	private selectTodaysCards(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				sessionType: "created-today",
				createdTodayOnly: true,
				ignoreDailyLimits: true,
			});
			this.resolvePromise = null;
		}
		this.close();
	}

	private getAllCardsStats(now: Date): { total: number; newCount: number; dueCount: number } {
		const cards = this.options.allCards.filter((c) =>
			this.isCardAvailable(c, now) && !c.fsrs.suspended && !this.isCardBuried(c, now)
		);

		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	private selectDefaultDeck(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				sessionType: "default",
				useDefaultDeck: true,
				ignoreDailyLimits: false,
			});
			this.resolvePromise = null;
		}
		this.close();
	}

	private selectBuriedCards(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				sessionType: "state-filter",
				stateFilter: "buried",
				ignoreDailyLimits: true,
				bypassScheduling: true,
			});
			this.resolvePromise = null;
		}
		this.close();
	}

	private startSelectedSession(): void {
		if (this.selectedNotes.size === 0) return;

		this.hasSelected = true;
		if (this.resolvePromise) {
			const noteFilters = Array.from(this.selectedNotes);

			this.resolvePromise({
				cancelled: false,
				sessionType: "select-notes",
				sourceNoteFilters: noteFilters,
				ignoreDailyLimits: true,
			});
			this.resolvePromise = null;
		}
		this.close();
	}
}
