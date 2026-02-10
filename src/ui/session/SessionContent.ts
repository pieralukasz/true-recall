/**
 * Session Content Component
 * Contains quick actions, search, and note selection table
 */
import { Platform } from "obsidian";
import { BaseComponent } from "../component.base";
import { createSectionHeader, createCardCountDisplay } from "../components";
import type { SessionLogic } from "./SessionLogic";
import type { FSRSFlashcardItem } from "../../types";
import type { SessionPreset } from "../../types/settings.types";

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
	onCustomStudyAction: (
		action: "failed" | "difficult" | "study-ahead" | "most-forgotten"
	) => void;
	onOpenCustomStudyModal: () => void;
	onPresetAction: (preset: SessionPreset) => void;
	onPresetDelete: (presetId: string) => void;
	sessionPresets: SessionPreset[];
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
			cls: "true-recall-session-content ep:flex ep:flex-col ep:h-full ep:gap-2",
		});

		// Section header with title (desktop only - matching Projects style)
		if (!Platform.isMobile) {
			createSectionHeader(this.element, { title: "Session" });
		}

		// Search input at the top
		this.renderSearchInput();

		// Quick actions section header
		createSectionHeader(this.element, {
			title: "Quick access",
			className: "true-recall-section-header ep:my-2",
		});

		// Quick actions section
		this.renderQuickActions();

		// Custom study section
		this.renderCustomStudySection();

		// Saved presets section
		if (this.props.sessionPresets.length > 0) {
			this.renderSavedPresets();
		}

		// Notes section header (fixed, not scrolling)
		createSectionHeader(this.element, {
			title: "Select notes",
			className: "true-recall-section-header ep:my-2 ep:shrink-0",
		});

		// Scroll wrapper for note list only
		const scrollWrapper = this.element.createDiv({
			cls: "true-recall-session-scroll ep:flex-1 ep:overflow-y-auto ep:min-h-0",
		});

		// Note list (card-based)
		this.renderNoteList(scrollWrapper);
	}

	private renderQuickActions(): void {
		const { currentNoteName, logic, onQuickAction } = this.props;
		const quickActionsEl = this.element!.createDiv({
			cls: "true-recall-quick-actions ep:grid ep:grid-cols-2 ep:gap-2",
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
		const statsCls = "ep:text-ui-smaller ep:text-obs-muted";
		const statsMutedCls = "ep:text-ui-smaller ep:text-obs-faint";

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
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
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
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
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
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
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
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
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

	private renderCustomStudySection(): void {
		const { logic, onCustomStudyAction, onOpenCustomStudyModal } = this.props;

		const headerContainer = this.element!.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between ep:my-2",
		});
		createSectionHeader(headerContainer, {
			title: "Custom study",
			className: "true-recall-section-header",
		});

		const customBtn = headerContainer.createEl("button", {
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:bg-transparent ep:border-none ep:cursor-pointer ep:hover:text-obs-normal ep:px-1",
			text: "Advanced",
			attr: { "aria-label": "Open custom study modal" },
		});
		this.events.addEventListener(customBtn, "click", () =>
			onOpenCustomStudyModal()
		);

		const customActionsEl = this.element!.createDiv({
			cls: "true-recall-custom-study ep:grid ep:grid-cols-2 ep:gap-2",
		});

		const baseBtnCls =
			"ep:flex ep:flex-col ep:items-start ep:gap-1 ep:px-3 ep:py-3 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:text-left ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive";
		const disabledBtnCls = [
			"ep:opacity-50",
			"ep:cursor-not-allowed",
			"ep:hover:bg-obs-secondary",
			"ep:hover:border-obs-border",
		];

		const failedCount = logic.getFailedCardsCount();
		const failedBtn = customActionsEl.createEl("button", { cls: baseBtnCls });
		failedBtn.createSpan({
			text: "Failed cards",
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
		});
		if (failedCount > 0) {
			failedBtn.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-muted",
				text: `${failedCount} cards`,
			});
			this.events.addEventListener(failedBtn, "click", () =>
				onCustomStudyAction("failed")
			);
		} else {
			failedBtn.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-faint",
				text: "none",
			});
			failedBtn.disabled = true;
			failedBtn.addClasses(disabledBtnCls);
		}

		const difficultCount = logic.getDifficultCardsCount();
		const difficultBtn = customActionsEl.createEl("button", { cls: baseBtnCls });
		difficultBtn.createSpan({
			text: "Difficult",
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
		});
		if (difficultCount > 0) {
			difficultBtn.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-muted",
				text: `${difficultCount} cards`,
			});
			this.events.addEventListener(difficultBtn, "click", () =>
				onCustomStudyAction("difficult")
			);
		} else {
			difficultBtn.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-faint",
				text: "none",
			});
			difficultBtn.disabled = true;
			difficultBtn.addClasses(disabledBtnCls);
		}

		const aheadCount = logic.getStudyAheadCount(3);
		const aheadBtn = customActionsEl.createEl("button", { cls: baseBtnCls });
		aheadBtn.createSpan({
			text: "Study ahead",
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
		});
		if (aheadCount > 0) {
			aheadBtn.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-muted",
				text: `${aheadCount} cards (3d)`,
			});
			this.events.addEventListener(aheadBtn, "click", () =>
				onCustomStudyAction("study-ahead")
			);
		} else {
			aheadBtn.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-faint",
				text: "none",
			});
			aheadBtn.disabled = true;
			aheadBtn.addClasses(disabledBtnCls);
		}

		const forgottenCount = logic.getMostForgottenCount(1);
		const forgottenBtn = customActionsEl.createEl("button", { cls: baseBtnCls });
		forgottenBtn.createSpan({
			text: "Most forgotten",
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
		});
		if (forgottenCount > 0) {
			forgottenBtn.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-muted",
				text: `${forgottenCount} cards`,
			});
			this.events.addEventListener(forgottenBtn, "click", () =>
				onCustomStudyAction("most-forgotten")
			);
		} else {
			forgottenBtn.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-faint",
				text: "none",
			});
			forgottenBtn.disabled = true;
			forgottenBtn.addClasses(disabledBtnCls);
		}
	}

	private renderSavedPresets(): void {
		const { sessionPresets, onPresetAction, onPresetDelete } = this.props;

		createSectionHeader(this.element!, {
			title: "Saved presets",
			className: "true-recall-section-header ep:my-2",
		});

		const presetsEl = this.element!.createDiv({
			cls: "true-recall-saved-presets ep:flex ep:flex-col ep:gap-1.5",
		});

		for (const preset of sessionPresets) {
			const row = presetsEl.createDiv({
				cls: "ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive ep:group",
			});

			const info = row.createDiv({ cls: "ep:flex-1 ep:min-w-0" });
			info.createSpan({
				text: preset.name,
				cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
			});

			const details: string[] = [];
			if (preset.crammingMode) details.push("cram");
			if (preset.stateFilter) details.push(preset.stateFilter);
			if (preset.reviewOrder && preset.reviewOrder !== "due-date")
				details.push(preset.reviewOrder);
			if (preset.cardLimit) details.push(`limit ${preset.cardLimit}`);
			if (details.length > 0) {
				info.createSpan({
					text: details.join(" \u00b7 "),
					cls: "ep:text-ui-smaller ep:text-obs-muted ep:ml-2",
				});
			}

			const deleteBtn = row.createEl("button", {
				cls: "ep:text-ui-smaller ep:text-obs-faint ep:bg-transparent ep:border-none ep:cursor-pointer ep:hover:text-obs-red ep:opacity-0 ep:group-hover:opacity-100 ep:px-1",
				text: "\u00d7",
				attr: { "aria-label": "Delete preset" },
			});

			this.events.addEventListener(row, "click", (e) => {
				if (e.target === deleteBtn) return;
				onPresetAction(preset);
			});
			this.events.addEventListener(deleteBtn, "click", (e) => {
				e.stopPropagation();
				onPresetDelete(preset.id);
			});
		}
	}

	private renderSearchInput(): void {
		const { searchQuery, onSearchChange } = this.props;
		const searchContainer = this.element!.createDiv({
			cls: "true-recall-search-container ep:mb-2",
		});
		const searchInput = searchContainer.createEl("input", {
			cls: "ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
			type: "text",
			placeholder: "Search notes...",
			attr: { "aria-label": "Search notes" },
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
			cls: "true-recall-note-list",
		});
		this.noteTableBody = noteListEl;

		if (filteredStats.length === 0) {
			noteListEl.createDiv({
				cls: "ep:text-center ep:py-8 ep:text-obs-muted ep:text-ui-small",
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
				cls: `ep:flex ep:items-center ep:gap-3 ep:py-2.5 ep:px-3 ep:border-b ep:border-obs-modifier-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0${
					isSelected ? " ep:bg-obs-interactive/10" : ""
				}`,
			});

			// Checkbox or completed tick
			if (hasCards) {
				const checkbox = item.createEl("input", {
					type: "checkbox",
					cls: "ep:shrink-0 ep:w-4 ep:h-4",
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
					cls: "ep:text-obs-green ep:text-ui-medium ep:font-semibold ep:w-4 ep:text-center",
					text: "\u2713",
				});
			}

			// Content container
			const content = item.createDiv({
				cls: "ep:flex-1 ep:min-w-0",
			});

			// Note name (allow 2 lines)
			const nameEl = content.createDiv({
				cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal ep:leading-snug ep:line-clamp-2",
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

			// Stats with Anki-style colored counts (matching Projects)
			const statsEl = content.createDiv({
				cls: "ep:text-ui-smaller ep:mt-0.5 ep:flex ep:items-center ep:gap-1",
			});
			if (hasCards) {
				createCardCountDisplay(statsEl, {
					newCount: stat.newCount,
					learningCount: 0,
					dueCount: stat.dueCount,
					variant: "compact",
					size: "smaller",
					bold: true,
				});
			} else {
				statsEl.createSpan({
					text: "done",
					cls: "ep:text-obs-faint",
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
}
