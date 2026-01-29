/**
 * Orphaned Cards Content
 * Content component for the orphaned cards panel
 * Displays and manages orphaned flashcards grouped by source
 */
import { App, TFile, normalizePath } from "obsidian";
import type TrueRecallPlugin from "../../main";
import type {
	OrphanedCardInfo,
	OrphanedCardGroup,
} from "../../services/flashcard/orphaned-cards.service";

/**
 * Content component for orphaned cards management
 */
export class OrphanedCardsContent {
	private container: HTMLElement;
	private plugin: TrueRecallPlugin;
	private app: App;

	private groups: OrphanedCardGroup[] = [];
	private contentContainer: HTMLElement | null = null;
	private selectedGroup: OrphanedCardGroup | null = null;

	// For move functionality
	private moveSection: HTMLElement | null = null;
	private noteListEl: HTMLElement | null = null;
	private searchQuery = "";
	private allNotes: TFile[] = [];

	constructor(container: HTMLElement, plugin: TrueRecallPlugin, app: App) {
		this.container = container;
		this.plugin = plugin;
		this.app = app;
	}

	render(): void {
		this.container.empty();
		this.container.addClass("true-recall-orphaned-cards-content");

		this.contentContainer = this.container.createDiv({
			cls: "ep:p-4",
		});

		this.allNotes = this.app.vault.getMarkdownFiles();
		this.loadOrphanedCards();
		this.renderContent();
	}

	refresh(): void {
		this.loadOrphanedCards();
		this.renderContent();
	}

	destroy(): void {
		this.container.empty();
		this.contentContainer = null;
		this.moveSection = null;
		this.noteListEl = null;
	}

	private loadOrphanedCards(): void {
		if (!this.plugin.orphanedCardsService || !this.plugin.cardStore || !this.plugin.frontmatterIndex) {
			this.groups = [];
			return;
		}

		const orphans = this.plugin.orphanedCardsService.getOrphanedCardsExtended(
			this.plugin.cardStore,
			this.plugin.frontmatterIndex
		);
		this.groups = this.plugin.orphanedCardsService.groupOrphanedCards(orphans);
	}

	private renderContent(): void {
		if (!this.contentContainer) return;
		this.contentContainer.empty();

		const totalCount = this.groups.reduce((sum, g) => sum + g.cards.length, 0);

		if (totalCount === 0) {
			this.renderEmptyState();
			return;
		}

		// Header with summary
		this.contentContainer.createEl("p", {
			text: `Found ${totalCount} orphaned card${totalCount === 1 ? "" : "s"} in ${this.groups.length} group${this.groups.length === 1 ? "" : "s"}.`,
			cls: "ep:text-obs-muted ep:text-ui-small ep:mb-4",
		});

		// Delete all button
		if (totalCount > 0) {
			const actionsRow = this.contentContainer.createDiv({
				cls: "ep:flex ep:justify-end ep:mb-3",
			});
			const deleteAllBtn = actionsRow.createEl("button", {
				text: `Delete all ${totalCount} cards`,
				cls: "ep:py-1.5 ep:px-3 ep:rounded ep:bg-red-600 ep:text-white ep:text-ui-smaller ep:cursor-pointer ep:hover:bg-red-700 ep:border-none",
			});
			deleteAllBtn.addEventListener("click", () => this.handleDeleteAll());
		}

		// Groups list
		const groupsContainer = this.contentContainer.createDiv({
			cls: "ep:max-h-[500px] ep:overflow-y-auto ep:border ep:border-obs-border ep:rounded",
		});

		for (const group of this.groups) {
			this.renderGroup(groupsContainer, group);
		}

		// Move section (hidden initially)
		this.moveSection = this.contentContainer.createDiv({
			cls: "ep:hidden ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border",
		});
	}

	private renderEmptyState(): void {
		if (!this.contentContainer) return;

		this.contentContainer.createDiv({
			cls: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:py-12",
		}).innerHTML = `
			<div class="ep:text-4xl ep:mb-4">✨</div>
			<div class="ep:text-obs-normal ep:text-ui-small ep:font-medium ep:mb-2">No orphaned cards!</div>
			<div class="ep:text-obs-muted ep:text-ui-smaller">All your flashcards are properly linked to source notes.</div>
		`;
	}

	private renderGroup(container: HTMLElement, group: OrphanedCardGroup): void {
		const groupEl = container.createDiv({
			cls: "ep:border-b ep:border-obs-border ep:last:border-b-0",
		});

		// Group header
		const headerEl = groupEl.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between ep:p-3 ep:bg-obs-secondary ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
		});

		// Left side: icon and info
		const infoEl = headerEl.createDiv({ cls: "ep:flex ep:items-center ep:gap-3" });

		const icon = group.reason === "no_source_uid" ? "❓" : "🗑️";
		infoEl.createSpan({ text: icon, cls: "ep:text-lg" });

		const textEl = infoEl.createDiv();
		textEl.createDiv({
			text: group.displayName,
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
		});
		textEl.createDiv({
			text: `${group.cards.length} card${group.cards.length === 1 ? "" : "s"}`,
			cls: "ep:text-ui-smaller ep:text-obs-muted",
		});

		// Right side: action buttons
		const actionsEl = headerEl.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});

		// Move button
		const moveBtn = actionsEl.createEl("button", {
			text: "Move",
			cls: "ep:py-1 ep:px-2 ep:rounded ep:bg-obs-interactive ep:text-white ep:text-ui-smaller ep:cursor-pointer ep:hover:opacity-80 ep:border-none",
		});
		moveBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.showMoveSection(group);
		});

		// Create note button
		const createBtn = actionsEl.createEl("button", {
			text: "Create Note",
			cls: "ep:py-1 ep:px-2 ep:rounded ep:bg-obs-secondary ep:text-obs-normal ep:text-ui-smaller ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:border ep:border-obs-border",
		});
		createBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.handleCreateNoteForGroup(group);
		});

		// Delete button
		const deleteBtn = actionsEl.createEl("button", {
			text: "Delete",
			cls: "ep:py-1 ep:px-2 ep:rounded ep:bg-red-600 ep:text-white ep:text-ui-smaller ep:cursor-pointer ep:hover:bg-red-700 ep:border-none",
		});
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.handleDeleteGroup(group);
		});

		// Expandable card list
		const cardsContainer = groupEl.createDiv({
			cls: "ep:hidden ep:pl-8 ep:pr-3 ep:pb-2",
		});

		// Toggle expansion on header click
		headerEl.addEventListener("click", () => {
			cardsContainer.toggleClass("ep:hidden", !cardsContainer.hasClass("ep:hidden"));
		});

		// Render first 5 cards as preview
		const maxPreview = 5;
		const cardsToShow = group.cards.slice(0, maxPreview);

		for (const card of cardsToShow) {
			const cardEl = cardsContainer.createDiv({
				cls: "ep:py-2 ep:border-b ep:border-obs-border ep:last:border-b-0",
			});

			const question = card.question.length > 100
				? card.question.slice(0, 100) + "..."
				: card.question;

			cardEl.createDiv({
				text: `Q: ${question}`,
				cls: "ep:text-ui-smaller ep:text-obs-normal",
			});
		}

		if (group.cards.length > maxPreview) {
			cardsContainer.createDiv({
				text: `... and ${group.cards.length - maxPreview} more`,
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:pt-2",
			});
		}
	}

	private showMoveSection(group: OrphanedCardGroup): void {
		if (!this.moveSection) return;

		this.selectedGroup = group;
		this.moveSection.empty();
		this.moveSection.removeClass("ep:hidden");

		// Section header
		this.moveSection.createEl("h4", {
			text: `Move ${group.cards.length} cards to:`,
			cls: "ep:text-ui-small ep:text-obs-normal ep:m-0 ep:mb-3",
		});

		// Search input
		const searchContainer = this.moveSection.createDiv({
			cls: "ep:mb-3",
		});
		const searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search notes...",
			cls: "ep:w-full ep:p-2 ep:rounded ep:border ep:border-obs-border ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small",
		});
		searchInput.addEventListener("input", (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value;
			this.renderNoteList();
		});

		// Note list
		this.noteListEl = this.moveSection.createDiv({
			cls: "ep:max-h-[200px] ep:overflow-y-auto ep:border ep:border-obs-border ep:rounded",
		});
		this.renderNoteList();

		// Cancel button
		const cancelBtn = this.moveSection.createEl("button", {
			text: "Cancel",
			cls: "ep:mt-3 ep:py-2 ep:px-4 ep:rounded ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
		});
		cancelBtn.addEventListener("click", () => {
			if (this.moveSection) {
				this.moveSection.addClass("ep:hidden");
				this.selectedGroup = null;
			}
		});
	}

	private renderNoteList(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			this.noteListEl.createDiv({
				text: "No notes found",
				cls: "ep:p-4 ep:text-center ep:text-obs-muted ep:text-ui-smaller",
			});
			return;
		}

		const displayNotes = filteredNotes.slice(0, 20);

		for (const note of displayNotes) {
			const noteEl = this.noteListEl.createDiv({
				cls: "ep:flex ep:items-center ep:gap-3 ep:p-3 ep:border-b ep:border-obs-border ep:last:border-b-0 ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
			});

			noteEl.createSpan({ text: "📄", cls: "ep:text-lg" });

			const textEl = noteEl.createDiv();
			textEl.createDiv({
				text: note.basename,
				cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
			});
			if (note.parent?.path && note.parent.path !== "/") {
				textEl.createDiv({
					text: note.parent.path,
					cls: "ep:text-ui-smaller ep:text-obs-muted",
				});
			}

			noteEl.addEventListener("click", () => void this.handleMoveToNote(note));
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
			.sort((a, b) => a.basename.localeCompare(b.basename));
	}

	private async handleMoveToNote(targetNote: TFile): Promise<void> {
		if (!this.selectedGroup) return;

		const frontmatterService = this.plugin.flashcardManager.getFrontmatterService();

		// Get or create flashcard_uid for target note
		let targetUid = await frontmatterService.getSourceNoteUid(targetNote);
		if (!targetUid) {
			targetUid = frontmatterService.generateUid();
			await frontmatterService.setSourceNoteUid(targetNote, targetUid);
		}

		// Update all cards in the group
		const cardIds = this.selectedGroup.cards.map((c) => c.id);
		for (const cardId of cardIds) {
			this.plugin.cardStore.cards.updateCardSourceUid(cardId, targetUid);
		}

		// Refresh and re-render
		this.refresh();
	}

	private handleDeleteGroup(group: OrphanedCardGroup): void {
		const confirmed = confirm(
			`Delete ${group.cards.length} card${group.cards.length === 1 ? "" : "s"}? This cannot be undone.`
		);

		if (!confirmed) return;

		const cardIds = group.cards.map((c) => c.id);
		this.plugin.cardStore.browser.bulkSoftDelete(cardIds);

		// Refresh and re-render
		this.refresh();
	}

	private handleDeleteAll(): void {
		const totalCount = this.groups.reduce((sum, g) => sum + g.cards.length, 0);

		const confirmed = confirm(
			`Delete all ${totalCount} orphaned cards? This cannot be undone.`
		);

		if (!confirmed) return;

		const allCardIds = this.groups.flatMap((g) => g.cards.map((c) => c.id));
		this.plugin.cardStore.browser.bulkSoftDelete(allCardIds);

		// Refresh and re-render
		this.refresh();
	}

	private async handleCreateNoteForGroup(group: OrphanedCardGroup): Promise<void> {
		const frontmatterService = this.plugin.flashcardManager.getFrontmatterService();
		const folderPath = this.app.fileManager.getNewFileParent("")?.path ?? "";
		const baseName = group.reason === "missing_source_file"
			? `Recovered cards (${group.groupKey})`
			: "Recovered orphaned cards";

		// Find unique file path
		let filePath = normalizePath(`${folderPath}/${baseName}.md`);
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(filePath)) {
			filePath = normalizePath(`${folderPath}/${baseName} ${counter}.md`);
			counter++;
		}

		// Generate new UID
		const newUid = frontmatterService.generateUid();

		// Create note content with card questions as reference
		const cardList = group.cards
			.slice(0, 10)
			.map((c) => `- ${c.question.slice(0, 80)}${c.question.length > 80 ? "..." : ""}`)
			.join("\n");

		const moreText = group.cards.length > 10
			? `\n- ... and ${group.cards.length - 10} more cards`
			: "";

		const content = `---
flashcard_uid: ${newUid}
tags:
  - recovered
---

# ${baseName}

This note was created to recover orphaned flashcards.

## Cards in this note

${cardList}${moreText}
`;

		// Create the file
		await this.app.vault.create(filePath, content);

		// Update all cards to point to this note
		const cardIds = group.cards.map((c) => c.id);
		for (const cardId of cardIds) {
			this.plugin.cardStore.cards.updateCardSourceUid(cardId, newUid);
		}

		// Refresh and re-render
		this.refresh();
	}
}
