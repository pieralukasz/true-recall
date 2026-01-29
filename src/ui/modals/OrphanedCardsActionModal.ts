/**
 * Orphaned Cards Action Modal
 * Shown when a note with flashcards is deleted
 * Allows user to decide what to do with the orphaned cards
 */
import { App, TFile, normalizePath } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";
import type { FSRSCardData } from "../../types";

export type OrphanedCardsAction =
	| "delete"
	| "move"
	| "create_note"
	| "leave_orphaned";

export interface OrphanedCardsActionResult {
	cancelled: boolean;
	action: OrphanedCardsAction;
	/** Target note path (for 'move' action) */
	targetNotePath?: string;
	/** New note path (for 'create_note' action) */
	newNotePath?: string;
}

export interface OrphanedCardsActionModalOptions {
	cards: FSRSCardData[];
	deletedNoteName: string;
	sourceUid: string;
}

/**
 * Modal for deciding what to do with orphaned cards after note deletion
 */
export class OrphanedCardsActionModal extends BasePromiseModal<OrphanedCardsActionResult> {
	private options: OrphanedCardsActionModalOptions;

	// For move action
	private searchQuery = "";
	private noteListEl: HTMLElement | null = null;
	private allNotes: TFile[] = [];
	private moveSection: HTMLElement | null = null;

	constructor(app: App, options: OrphanedCardsActionModalOptions) {
		super(app, {
			title: `Note deleted - ${options.cards.length} flashcard${options.cards.length === 1 ? "" : "s"}`,
			width: "550px",
		});
		this.options = options;
	}

	protected getDefaultResult(): OrphanedCardsActionResult {
		return { cancelled: false, action: "leave_orphaned" };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-orphaned-cards-modal");
		this.allNotes = this.app.vault.getMarkdownFiles();
	}

	protected renderBody(container: HTMLElement): void {
		// Info section
		container.createEl("p", {
			text: `The note "${this.options.deletedNoteName}" was deleted. What would you like to do with its ${this.options.cards.length} flashcard${this.options.cards.length === 1 ? "" : "s"}?`,
			cls: "ep:text-obs-normal ep:text-ui-small ep:mb-4",
		});

		// Card preview
		this.renderCardPreview(container);

		// Action buttons
		this.renderActionButtons(container);

		// Move section (hidden initially)
		this.moveSection = container.createDiv({
			cls: "ep:hidden ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border",
		});
	}

	private renderCardPreview(container: HTMLElement): void {
		const previewContainer = container.createDiv({
			cls: "ep:mb-4 ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:border ep:border-obs-border",
		});

		previewContainer.createEl("h4", {
			text: "Card preview",
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:m-0 ep:mb-2",
		});

		const maxPreview = 3;
		const cardsToShow = this.options.cards.slice(0, maxPreview);

		for (const card of cardsToShow) {
			const cardEl = previewContainer.createDiv({
				cls: "ep:py-1.5 ep:border-b ep:border-obs-border ep:last:border-b-0",
			});

			// Question (truncated)
			const question = card.question ?? "No question";
			const truncatedQ = question.length > 80 ? question.slice(0, 80) + "..." : question;
			cardEl.createDiv({
				text: `Q: ${truncatedQ}`,
				cls: "ep:text-ui-smaller ep:text-obs-normal",
			});
		}

		if (this.options.cards.length > maxPreview) {
			previewContainer.createDiv({
				text: `... and ${this.options.cards.length - maxPreview} more`,
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:pt-1",
			});
		}
	}

	private renderActionButtons(container: HTMLElement): void {
		const actionsContainer = container.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-2",
		});

		// Delete button
		this.createActionButton(actionsContainer, {
			icon: "trash-2",
			label: "Delete cards",
			description: "Permanently remove these flashcards",
			type: "danger",
			onClick: () => this.handleDelete(),
		});

		// Move button
		this.createActionButton(actionsContainer, {
			icon: "folder",
			label: "Move to another note",
			description: "Transfer cards to an existing note",
			type: "secondary",
			onClick: () => this.showMoveSection(),
		});

		// Create note button
		this.createActionButton(actionsContainer, {
			icon: "file-plus",
			label: "Create new note",
			description: "Create a note with these cards",
			type: "secondary",
			onClick: () => this.handleCreateNote(),
		});

		// Leave orphaned button (smaller, muted)
		actionsContainer.createEl("button", {
			text: "Leave as orphaned (can manage later in Settings)",
			cls: "ep:w-full ep:py-2 ep:px-3 ep:rounded ep:text-ui-smaller ep:text-obs-muted ep:bg-transparent ep:border ep:border-obs-border ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:mt-2",
		}).addEventListener("click", () => {
			this.resolve({ cancelled: false, action: "leave_orphaned" });
		});
	}

	private createActionButton(
		container: HTMLElement,
		config: {
			icon: string;
			label: string;
			description: string;
			type: "primary" | "secondary" | "danger";
			onClick: () => void;
		}
	): void {
		const btnCls = config.type === "danger"
			? "ep:bg-red-600 ep:text-white ep:hover:bg-red-700"
			: "ep:bg-obs-secondary ep:text-obs-normal ep:hover:bg-obs-modifier-hover";

		const btn = container.createEl("button", {
			cls: `ep:w-full ep:py-3 ep:px-4 ep:rounded-md ep:border ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:text-left ${btnCls}`,
		});

		const content = btn.createDiv({ cls: "ep:flex ep:items-center ep:gap-3" });

		// Icon placeholder (simple text for now)
		const iconMap: Record<string, string> = {
			"trash-2": "🗑️",
			"folder": "📁",
			"file-plus": "📝",
		};
		content.createSpan({
			text: iconMap[config.icon] ?? "•",
			cls: "ep:text-lg",
		});

		const textContainer = content.createDiv();
		textContainer.createDiv({
			text: config.label,
			cls: "ep:font-medium ep:text-ui-small",
		});
		textContainer.createDiv({
			text: config.description,
			cls: "ep:text-ui-smaller ep:opacity-70",
		});

		btn.addEventListener("click", config.onClick);
	}

	private handleDelete(): void {
		const confirmed = confirm(
			`Are you sure you want to delete ${this.options.cards.length} flashcard${this.options.cards.length === 1 ? "" : "s"}? This cannot be undone.`
		);

		if (confirmed) {
			this.resolve({ cancelled: false, action: "delete" });
		}
	}

	private showMoveSection(): void {
		if (!this.moveSection) return;

		this.moveSection.empty();
		this.moveSection.removeClass("ep:hidden");

		// Section header
		this.moveSection.createEl("h4", {
			text: "Select target note",
			cls: "ep:text-ui-small ep:text-obs-normal ep:m-0 ep:mb-3",
		});

		// Search input
		this.createSearchInput(this.moveSection, "Search notes...", (query) => {
			this.searchQuery = query;
			this.renderNoteList();
		});

		// Note list
		this.noteListEl = this.createListContainer(this.moveSection, "250px");
		this.renderNoteList();

		// Cancel button
		this.moveSection.createEl("button", {
			text: "Cancel",
			cls: "ep:mt-3 ep:py-2 ep:px-4 ep:rounded ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
		}).addEventListener("click", () => {
			if (this.moveSection) {
				this.moveSection.addClass("ep:hidden");
			}
		});
	}

	private renderNoteList(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			this.createEmptyState(this.noteListEl, "No notes found");
			return;
		}

		const displayNotes = filteredNotes.slice(0, 30);

		for (const note of displayNotes) {
			this.createListItem(
				this.noteListEl,
				{
					icon: "📄",
					name: note.basename,
					description: note.parent?.path !== "/" ? note.parent?.path : undefined,
				},
				() => this.handleMoveToNote(note.path)
			);
		}

		if (filteredNotes.length > 30) {
			this.noteListEl.createDiv({
				text: `Showing 30 of ${filteredNotes.length} notes`,
				cls: "ep:p-3 ep:text-center ep:text-obs-muted ep:text-ui-smaller",
			});
		}
	}

	private filterNotes(): TFile[] {
		if (!this.searchQuery) {
			return this.allNotes.sort((a, b) => b.stat.mtime - a.stat.mtime);
		}

		const query = this.searchQuery.toLowerCase();
		return this.allNotes
			.filter((note) =>
				note.basename.toLowerCase().includes(query) ||
				note.path.toLowerCase().includes(query)
			)
			.sort((a, b) => {
				const aExact = a.basename.toLowerCase().startsWith(query);
				const bExact = b.basename.toLowerCase().startsWith(query);
				if (aExact && !bExact) return -1;
				if (bExact && !aExact) return 1;
				return a.basename.localeCompare(b.basename);
			});
	}

	private handleMoveToNote(notePath: string): void {
		this.resolve({
			cancelled: false,
			action: "move",
			targetNotePath: notePath,
		});
	}

	private async handleCreateNote(): Promise<void> {
		const folderPath = this.app.fileManager.getNewFileParent("")?.path ?? "";
		const baseName = `Recovered - ${this.options.deletedNoteName}`;

		// Find unique file path
		let filePath = normalizePath(`${folderPath}/${baseName}.md`);
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(filePath)) {
			filePath = normalizePath(`${folderPath}/${baseName} ${counter}.md`);
			counter++;
		}

		this.resolve({
			cancelled: false,
			action: "create_note",
			newNotePath: filePath,
		});
	}
}
