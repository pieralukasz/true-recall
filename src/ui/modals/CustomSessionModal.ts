/**
 * Custom Session Modal
 * Allows user to select custom review session type and filters
 */
import { App } from "obsidian";
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "../../types";
import { BaseModal } from "./BaseModal";

export type CustomSessionType = "current-note" | "created-today" | "created-this-week" | "weak-cards" | "all-cards" | "select-notes" | "state-filter";

export interface CustomSessionResult {
	cancelled: boolean;
	sessionType: CustomSessionType | null;
	sourceNoteFilter?: string;
	sourceNoteFilters?: string[];
	filePathFilter?: string;
	createdTodayOnly?: boolean;
	createdThisWeek?: boolean;
	weakCardsOnly?: boolean;
	stateFilter?: "due" | "learning" | "new";
	temporaryOnly?: boolean;
	ignoreDailyLimits: boolean;
}

export interface CustomSessionModalOptions {
	currentNoteName: string | null;
	allCards: FSRSFlashcardItem[];
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
		super(app, { title: "Custom Review Session", width: "500px" });
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

		// Stats
		const todayStats = this.getTodayStats(now, todayStart);
		const thisWeekStats = this.getThisWeekStats(now);
		const allCardsStats = this.getAllCardsStats(now);

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

		// Week button
		const thisWeekBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn",
		});
		thisWeekBtn.createSpan({ text: "Week" });
		if (thisWeekStats.total > 0) {
			thisWeekBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: this.formatStats(thisWeekStats.newCount, thisWeekStats.dueCount),
			});
			thisWeekBtn.addEventListener("click", () => this.selectThisWeek());
		} else {
			thisWeekBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "no cards",
			});
			thisWeekBtn.disabled = true;
			thisWeekBtn.addClass("episteme-btn-disabled");
		}

		// All cards button
		const allCardsBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn",
		});
		allCardsBtn.createSpan({ text: "All" });
		if (allCardsStats.total > 0) {
			allCardsBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: this.formatStats(allCardsStats.newCount, allCardsStats.dueCount),
			});
			allCardsBtn.addEventListener("click", () => this.selectAllCards());
		} else {
			allCardsBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "no cards",
			});
			allCardsBtn.disabled = true;
			allCardsBtn.addClass("episteme-btn-disabled");
		}

		// State stats
		const dueStats = this.getDueStats(now);
		const learningStats = this.getLearningStats(now);
		const newStats = this.getNewStats(now);

		// Due button
		const dueBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn",
		});
		dueBtn.createSpan({ text: "Due" });
		if (dueStats.total > 0) {
			dueBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: this.formatStats(dueStats.newCount, dueStats.dueCount),
			});
			dueBtn.addEventListener("click", () => this.selectByState("due"));
		} else {
			dueBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "no cards",
			});
			dueBtn.disabled = true;
			dueBtn.addClass("episteme-btn-disabled");
		}

		// Learning button
		const learningBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn",
		});
		learningBtn.createSpan({ text: "Learning" });
		if (learningStats.total > 0) {
			learningBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: this.formatStats(learningStats.newCount, learningStats.dueCount),
			});
			learningBtn.addEventListener("click", () => this.selectByState("learning"));
		} else {
			learningBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "no cards",
			});
			learningBtn.disabled = true;
			learningBtn.addClass("episteme-btn-disabled");
		}

		// New button
		const newBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn",
		});
		newBtn.createSpan({ text: "New" });
		if (newStats.total > 0) {
			newBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: this.formatStats(newStats.newCount, newStats.dueCount),
			});
			newBtn.addEventListener("click", () => this.selectByState("new"));
		} else {
			newBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "no cards",
			});
			newBtn.disabled = true;
			newBtn.addClass("episteme-btn-disabled");
		}

		// Temporary button (cards from Literature Notes)
		const temporaryStats = this.getTemporaryStats(now);
		const tempBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn episteme-quick-action-btn--temporary",
		});
		tempBtn.createSpan({ text: "Temporary" });
		if (temporaryStats.total > 0) {
			tempBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: this.formatStats(temporaryStats.newCount, temporaryStats.dueCount),
			});
			tempBtn.addEventListener("click", () => this.selectTemporaryCards());
		} else {
			tempBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "no cards",
			});
			tempBtn.disabled = true;
			tempBtn.addClass("episteme-btn-disabled");
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

		// Filter by search query
		const filteredStats = allNoteStats.filter((stat) =>
			stat.noteName.toLowerCase().includes(this.searchQuery)
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
					if ((e.target as HTMLElement).tagName !== "INPUT") {
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
			return createdAt && createdAt >= todayStart.getTime() && this.isCardAvailable(c, now);
		});

		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	private getAllCardsStats(now: Date): { total: number; newCount: number; dueCount: number } {
		const cards = this.options.allCards.filter((c) => this.isCardAvailable(c, now));

		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	private getThisWeekStats(now: Date): { total: number; newCount: number; dueCount: number } {
		const weekAgo = new Date();
		weekAgo.setDate(weekAgo.getDate() - 7);
		weekAgo.setHours(0, 0, 0, 0);

		const cards = this.options.allCards.filter((c) => {
			const createdAt = c.fsrs.createdAt;
			return createdAt && createdAt >= weekAgo.getTime() && this.isCardAvailable(c, now);
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
			const availableCards = cards.filter((c) => this.isCardAvailable(c, now));
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
		if (card.fsrs.state === State.New) return true;
		return new Date(card.fsrs.due) <= now;
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

	private selectThisWeek(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				sessionType: "created-this-week",
				createdThisWeek: true,
				ignoreDailyLimits: true,
			});
			this.resolvePromise = null;
		}
		this.close();
	}

	private selectAllCards(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				sessionType: "all-cards",
				ignoreDailyLimits: true,
			});
			this.resolvePromise = null;
		}
		this.close();
	}

	private getDueStats(now: Date): { total: number; newCount: number; dueCount: number } {
		const cards = this.options.allCards.filter((c) => {
			if (c.fsrs.state !== State.Review) return false;
			return new Date(c.fsrs.due) <= now;
		});
		return { total: cards.length, newCount: 0, dueCount: cards.length };
	}

	private getLearningStats(_now: Date): { total: number; newCount: number; dueCount: number } {
		// Count ALL learning/relearning cards (not just due ones)
		// because stateFilter="learning" will load them all (including pending cards)
		const cards = this.options.allCards.filter((c) => {
			return c.fsrs.state === State.Learning || c.fsrs.state === State.Relearning;
		});
		return { total: cards.length, newCount: 0, dueCount: cards.length };
	}

	private getNewStats(_now: Date): { total: number; newCount: number; dueCount: number } {
		const cards = this.options.allCards.filter((c) => c.fsrs.state === State.New);
		return { total: cards.length, newCount: cards.length, dueCount: 0 };
	}

	private getTemporaryStats(now: Date): { total: number; newCount: number; dueCount: number } {
		const cards = this.options.allCards.filter((c) => c.isTemporary && this.isCardAvailable(c, now));
		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	private selectByState(stateFilter: "due" | "learning" | "new"): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				sessionType: "state-filter",
				stateFilter,
				ignoreDailyLimits: true,
			});
			this.resolvePromise = null;
		}
		this.close();
	}

	private selectTemporaryCards(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				sessionType: "state-filter",
				temporaryOnly: true,
				ignoreDailyLimits: true,
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
