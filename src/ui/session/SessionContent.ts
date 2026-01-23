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
	onNavigateToNote: (notePath: string) => void;
}

/**
 * Session content component
 */
export class SessionContent extends BaseComponent {
	private props: SessionContentProps;
	private noteTableBody: HTMLElement | null = null;

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

		// Search input at the top
		this.renderSearchInput();

		// Quick actions section header
		this.element.createDiv({
			cls: "episteme-section-header",
			text: "Quick access",
		});

		// Quick actions section
		this.renderQuickActions();

		// Notes section header
		this.element.createDiv({
			cls: "episteme-section-header",
			text: "Select notes",
		});

		// Note list (card-based)
		this.renderNoteList();
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
		const searchInput = searchContainer.createEl("input", {
			cls: "episteme-search-input",
			type: "text",
			placeholder: "Search notes...",
		});
		searchInput.value = searchQuery;

		this.events.addEventListener(searchInput, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			onSearchChange(query);
		});
	}

	private renderNoteList(): void {
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

		for (const stat of filteredStats) {
			const hasCards = stat.newCount > 0 || stat.dueCount > 0;
			const isSelected = selectedNotes.has(stat.noteName);

			// Note item container
			const item = noteListEl.createDiv({
				cls: `episteme-note-item${isSelected ? " episteme-note-item--selected" : ""}`,
			});

			// Checkbox or completed tick
			if (hasCards) {
				const checkbox = item.createEl("input", { type: "checkbox" });
				checkbox.checked = isSelected;

				this.events.addEventListener(checkbox, "change", () => {
					this.props.onNoteToggle(stat.noteName);
				});

				// Make whole item clickable
				this.events.addEventListener(item, "click", (e) => {
					const target = e.target;
					if (target instanceof HTMLElement && target.tagName !== "INPUT" && target.tagName !== "A") {
						checkbox.checked = !checkbox.checked;
						this.props.onNoteToggle(stat.noteName);
					}
				});
			} else if (stat.isCompleted) {
				item.createSpan({
					cls: "episteme-completed-tick",
					text: "\u2713",
				});
			}

			// Content container
			const content = item.createDiv({ cls: "episteme-note-item-content" });

			// Note name (allow 2 lines)
			const nameEl = content.createDiv({ cls: "episteme-note-item-name" });
			if (stat.notePath) {
				const nameLink = nameEl.createEl("a", {
					text: stat.noteName,
					href: "#",
				});
				this.events.addEventListener(nameLink, "click", (e) => {
					e.preventDefault();
					e.stopPropagation();
					this.props.onNavigateToNote(stat.notePath!);
				});
			} else {
				nameEl.textContent = stat.noteName;
			}

			// Stats badge
			const statsEl = content.createDiv({
				cls: `episteme-note-item-stats${!hasCards ? " episteme-stat-muted" : ""}`,
			});
			if (hasCards) {
				statsEl.textContent = logic.formatStats(stat.newCount, stat.dueCount);
			} else {
				statsEl.textContent = "done";
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
}
