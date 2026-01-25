/**
 * Session Content Component
 * Contains quick actions, search, and note selection table
 */
import { BaseComponent } from "../component.base";
import type { SessionLogic } from "./SessionLogic";
import type { FSRSFlashcardItem } from "../../types";

export interface SessionContentProps {
	currentNoteName: string | null;
	allCards: FSRSFlashcardItem[];
	selectedNotes: Set<string>;
	searchQuery: string;
	now: Date;
	logic: SessionLogic;
	onQuickAction: (
		action: "current-note" | "today" | "default" | "buried"
	) => void;
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
			cls: "episteme-session-content ep:flex ep:flex-col ep:h-full ep:gap-2 ep:px-1.5 ep:pb-6",
		});

		// Search input at the top
		this.renderSearchInput();

		// Quick actions section header
		this.element.createDiv({
			cls: "episteme-section-header ep:text-xs ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wide ep:my-2",
			text: "Quick access",
		});

		// Quick actions section
		this.renderQuickActions();

		// Scroll wrapper for "Select notes" header + note list
		const scrollWrapper = this.element.createDiv({
			cls: "ep:flex-1 ep:overflow-y-auto",
		});

		// Notes section header
		scrollWrapper.createDiv({
			cls: "episteme-section-header ep:text-xs ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wide ep:my-2",
			text: "Select notes",
		});

		// Note list (card-based)
		this.renderNoteList(scrollWrapper);
	}

	private renderQuickActions(): void {
		const { currentNoteName, logic, onQuickAction } = this.props;
		const quickActionsEl = this.element!.createDiv({
			cls: "episteme-quick-actions ep:grid ep:grid-cols-2 ep:gap-2",
		});

		const now = new Date();
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		// Shared button classes
		const baseBtnCls =
			"ep:flex ep:flex-col ep:items-start ep:gap-1.5 ep:px-3 ep:py-3 ep:min-h-[3rem] ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:text-left ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive";
		const disabledBtnCls = [
			"ep:opacity-50",
			"ep:cursor-not-allowed",
			"ep:hover:bg-obs-secondary",
			"ep:hover:border-obs-border",
		];
		const statsCls = "ep:text-xs ep:text-obs-muted";
		const statsMutedCls = "ep:text-xs ep:text-obs-faint";

		// Active Note button
		const currentNoteStats = logic.getCurrentNoteStats(
			currentNoteName,
			now
		);
		const activeNoteBtn = quickActionsEl.createEl("button", {
			cls: baseBtnCls,
		});
		activeNoteBtn.createSpan({
			text: "Active note",
			cls: "ep:text-sm ep:font-medium ep:text-obs-normal",
		});
		if (currentNoteStats && currentNoteStats.total > 0) {
			activeNoteBtn.createSpan({
				cls: statsCls,
				text: logic.formatStats(
					currentNoteStats.newCount,
					currentNoteStats.dueCount
				),
			});
			this.events.addEventListener(activeNoteBtn, "click", () =>
				onQuickAction("current-note")
			);
		} else {
			activeNoteBtn.createSpan({
				cls: statsMutedCls,
				text: currentNoteStats ? "done" : "no cards",
			});
			activeNoteBtn.disabled = true;
			activeNoteBtn.addClasses(disabledBtnCls);
		}

		// Today button
		const todayStats = logic.getTodayStats(now, todayStart);
		const todayBtn = quickActionsEl.createEl("button", {
			cls: baseBtnCls,
		});
		todayBtn.createSpan({
			text: "Today",
			cls: "ep:text-sm ep:font-medium ep:text-obs-normal",
		});
		if (todayStats.total > 0) {
			todayBtn.createSpan({
				cls: statsCls,
				text: logic.formatStats(
					todayStats.newCount,
					todayStats.dueCount
				),
			});
			this.events.addEventListener(todayBtn, "click", () =>
				onQuickAction("today")
			);
		} else {
			todayBtn.createSpan({
				cls: statsMutedCls,
				text: "no cards",
			});
			todayBtn.disabled = true;
			todayBtn.addClasses(disabledBtnCls);
		}

		// Default button
		const defaultBtn = quickActionsEl.createEl("button", {
			cls: baseBtnCls,
		});
		defaultBtn.createSpan({
			text: "Default",
			cls: "ep:text-sm ep:font-medium ep:text-obs-normal",
		});
		const allCardsStats = logic.getAllCardsStats(now);
		if (allCardsStats.total > 0) {
			defaultBtn.createSpan({
				cls: statsCls,
				text: logic.formatStats(
					allCardsStats.newCount,
					allCardsStats.dueCount
				),
			});
			this.events.addEventListener(defaultBtn, "click", () =>
				onQuickAction("default")
			);
		} else {
			defaultBtn.createSpan({
				cls: statsMutedCls,
				text: "no cards",
			});
			defaultBtn.disabled = true;
			defaultBtn.addClasses(disabledBtnCls);
		}

		// Buried cards button
		const buriedBtn = quickActionsEl.createEl("button", {
			cls: baseBtnCls,
		});
		buriedBtn.createSpan({
			text: "Buried",
			cls: "ep:text-sm ep:font-medium ep:text-obs-normal",
		});
		const buriedStats = logic.getBuriedCardsStats(now);
		if (buriedStats.total > 0) {
			buriedBtn.createSpan({
				cls: statsCls,
				text: logic.formatStats(
					buriedStats.newCount,
					buriedStats.dueCount
				),
			});
			this.events.addEventListener(buriedBtn, "click", () =>
				onQuickAction("buried")
			);
		} else {
			buriedBtn.createSpan({
				cls: statsMutedCls,
				text: "none",
			});
			buriedBtn.disabled = true;
			buriedBtn.addClasses(disabledBtnCls);
		}
	}

	private renderSearchInput(): void {
		const { searchQuery, onSearchChange } = this.props;
		const searchContainer = this.element!.createDiv({
			cls: "episteme-search-container ep:mb-2",
		});
		const searchInput = searchContainer.createEl("input", {
			cls: "ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-sm ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
			type: "text",
			placeholder: "Search notes...",
		});
		searchInput.value = searchQuery;

		this.events.addEventListener(searchInput, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			onSearchChange(query);
		});
	}

	private renderNoteList(container: HTMLElement): void {
		const { searchQuery, now, logic, selectedNotes } = this.props;

		const filteredStats = logic.getFilteredNoteStats(searchQuery, now);

		const noteListEl = container.createDiv({
			cls: "episteme-note-list",
		});
		this.noteTableBody = noteListEl;

		if (filteredStats.length === 0) {
			noteListEl.createDiv({
				cls: "ep:text-center ep:py-8 ep:text-obs-muted ep:text-sm",
				text: searchQuery
					? "No notes match your search"
					: "No notes with flashcards found",
			});
			return;
		}

		for (const stat of filteredStats) {
			const hasCards = stat.newCount > 0 || stat.dueCount > 0;
			const isSelected = selectedNotes.has(stat.noteName);

			// Note item container
			const item = noteListEl.createDiv({
				cls: `ep:flex ep:items-start ep:gap-3 ep:py-2.5 ep:px-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0${
					isSelected ? " ep:bg-obs-interactive/10" : ""
				}`,
			});

			// Checkbox or completed tick
			if (hasCards) {
				const checkbox = item.createEl("input", {
					type: "checkbox",
					cls: "ep:mt-0.5 ep:shrink-0 ep:w-4 ep:h-4",
				});
				checkbox.checked = isSelected;

				this.events.addEventListener(checkbox, "change", () => {
					this.props.onNoteToggle(stat.noteName);
				});

				// Make whole item clickable
				this.events.addEventListener(item, "click", (e) => {
					const target = e.target;
					if (
						target instanceof HTMLElement &&
						target.tagName !== "INPUT" &&
						target.tagName !== "A"
					) {
						checkbox.checked = !checkbox.checked;
						this.props.onNoteToggle(stat.noteName);
					}
				});
			} else if (stat.isCompleted) {
				item.createSpan({
					cls: "ep:text-green-500 ep:text-base ep:font-semibold ep:w-4 ep:text-center",
					text: "\u2713",
				});
			}

			// Content container
			const content = item.createDiv({
				cls: "ep:flex-1 ep:min-w-0",
			});

			// Note name (allow 2 lines)
			const nameEl = content.createDiv({
				cls: "ep:text-sm ep:font-medium ep:text-obs-normal ep:leading-snug ep:line-clamp-2",
			});
			if (stat.notePath) {
				const nameLink = nameEl.createEl("a", {
					text: stat.noteName,
					href: "#",
					cls: "ep:text-obs-normal ep:no-underline ep:hover:text-obs-link ep:hover:underline",
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
				cls: `ep:text-xs ep:mt-0.5 ${
					hasCards ? "ep:text-obs-muted" : "ep:text-obs-faint"
				}`,
			});
			if (hasCards) {
				statsEl.textContent = logic.formatStats(
					stat.newCount,
					stat.dueCount
				);
			} else {
				// eslint-disable-next-line obsidianmd/ui/sentence-case
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
