/**
 * Session Content Component
 * Contains quick actions, search, and note selection table
 */
import { BaseComponent } from "../component.base";
import type { SessionLogic, NoteStats } from "../../logic/SessionLogic";
import type { FSRSFlashcardItem } from "../../types";

export interface SessionContentProps {
	currentNoteName: string | null;
	allCards: FSRSFlashcardItem[];
	selectedNotes: Set<string>;
	searchQuery: string;
	now: Date;
	logic: SessionLogic;
	onQuickAction: (action: "current-note" | "today" | "default" | "buried") => void;
	onNoteToggle: (noteName: string) => void;
	onSearchChange: (query: string) => void;
	onSelectAll: (select: boolean) => void;
}

/**
 * Session content component
 */
export class SessionContent extends BaseComponent {
	private props: SessionContentProps;
	private noteTableBody: HTMLElement | null = null;
	private searchInput: HTMLInputElement | null = null;

	constructor(container: HTMLElement, props: SessionContentProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		// Clear existing element if any
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-session-content",
		});

		// Quick actions section
		this.renderQuickActions();

		// Divider
		this.element.createEl("hr", { cls: "episteme-modal-divider" });

		// Notes section header
		this.element.createEl("h3", { text: "Or select notes to review:" });

		// Search input
		this.renderSearchInput();

		// Note table
		this.renderNoteTable();
	}

	private renderQuickActions(): void {
		const { currentNoteName, logic, onQuickAction } = this.props;
		const quickActionsEl = this.element!.createDiv({
			cls: "episteme-quick-actions",
		});

		const now = new Date();
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		// Active Note button
		const currentNoteStats = logic.getCurrentNoteStats(currentNoteName, now);
		const activeNoteBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn",
		});
		activeNoteBtn.createSpan({ text: "Active note" });
		if (currentNoteStats && currentNoteStats.total > 0) {
			activeNoteBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: logic.formatStats(currentNoteStats.newCount, currentNoteStats.dueCount),
			});
			this.events.addEventListener(activeNoteBtn, "click", () => onQuickAction("current-note"));
		} else {
			activeNoteBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: currentNoteStats ? "done" : "no cards",
			});
			activeNoteBtn.disabled = true;
			activeNoteBtn.addClass("episteme-btn-disabled");
		}

		// Today button
		const todayStats = logic.getTodayStats(now, todayStart);
		const todayBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn",
		});
		todayBtn.createSpan({ text: "Today" });
		if (todayStats.total > 0) {
			todayBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: logic.formatStats(todayStats.newCount, todayStats.dueCount),
			});
			this.events.addEventListener(todayBtn, "click", () => onQuickAction("today"));
		} else {
			todayBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "no cards",
			});
			todayBtn.disabled = true;
			todayBtn.addClass("episteme-btn-disabled");
		}

		// Default button
		const defaultBtn = quickActionsEl.createEl("button", {
			cls: "episteme-quick-action-btn episteme-default-btn",
		});
		defaultBtn.createSpan({ text: "Default" });
		const allCardsStats = logic.getAllCardsStats(now);
		if (allCardsStats.total > 0) {
			defaultBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: logic.formatStats(allCardsStats.newCount, allCardsStats.dueCount),
			});
			this.events.addEventListener(defaultBtn, "click", () => onQuickAction("default"));
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
		const buriedStats = logic.getBuriedCardsStats(now);
		if (buriedStats.total > 0) {
			buriedBtn.createSpan({
				cls: "episteme-quick-action-stats",
				text: logic.formatStats(buriedStats.newCount, buriedStats.dueCount),
			});
			this.events.addEventListener(buriedBtn, "click", () => onQuickAction("buried"));
		} else {
			buriedBtn.createSpan({
				cls: "episteme-quick-action-stats episteme-stat-muted",
				text: "none",
			});
			buriedBtn.disabled = true;
			buriedBtn.addClass("episteme-btn-disabled");
		}
	}

	private renderSearchInput(): void {
		const { searchQuery, onSearchChange } = this.props;
		const searchContainer = this.element!.createDiv({
			cls: "episteme-search-container",
		});
		this.searchInput = searchContainer.createEl("input", {
			cls: "episteme-search-input",
			type: "text",
			placeholder: "Search notes...",
		});
		this.searchInput.value = searchQuery;

		this.events.addEventListener(this.searchInput, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			onSearchChange(query);
		});
	}

	private renderNoteTable(): void {
		const { searchQuery, now, logic, selectedNotes } = this.props;

		const filteredStats = logic.getFilteredNoteStats(searchQuery, now);

		const noteListEl = this.element!.createDiv({
			cls: "episteme-note-list",
		});
		this.noteTableBody = noteListEl;

		if (filteredStats.length === 0) {
			noteListEl.createDiv({
				cls: "episteme-note-list-empty",
				text: searchQuery ? "No notes match your search" : "No notes with flashcards found",
			});
			return;
		}

		// Create table
		const table = noteListEl.createEl("table", { cls: "episteme-note-table" });

		// Header
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");

		// Select all checkbox
		const selectAllTh = headerRow.createEl("th", { cls: "episteme-note-checkbox-col" });
		const selectAllCheckbox = selectAllTh.createEl("input", { type: "checkbox" });

		// Check if all available notes are selected
		const availableNotes = filteredStats.filter((s) => s.newCount > 0 || s.dueCount > 0);
		const allSelected = availableNotes.length > 0 && availableNotes.every((s) => selectedNotes.has(s.noteName));
		selectAllCheckbox.checked = allSelected;
		selectAllCheckbox.indeterminate = !allSelected && availableNotes.some((s) => selectedNotes.has(s.noteName));

		this.events.addEventListener(selectAllCheckbox, "change", () => {
			this.props.onSelectAll(selectAllCheckbox.checked);
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
				checkbox.checked = selectedNotes.has(stat.noteName);

				this.events.addEventListener(checkbox, "change", () => {
					this.props.onNoteToggle(stat.noteName);
				});

				// Make whole row clickable
				this.events.addEventListener(row, "click", (e) => {
					const target = e.target;
					if (target instanceof HTMLElement && target.tagName !== "INPUT") {
						checkbox.checked = !checkbox.checked;
						this.props.onNoteToggle(stat.noteName);
					}
				});
				row.addClass("episteme-note-row--clickable");
			} else if (stat.isCompleted) {
				// Show tick for completed notes
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
					text: logic.formatStats(stat.newCount, stat.dueCount),
				});
			} else {
				statsTd.createSpan({
					cls: "episteme-stat-muted",
					text: "done",
				});
			}
		}
	}

	/**
	 * Update the content with new props
	 */
	updateProps(props: Partial<SessionContentProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}

	/**
	 * Focus the search input
	 */
	focusSearch(): void {
		this.searchInput?.focus();
	}
}
