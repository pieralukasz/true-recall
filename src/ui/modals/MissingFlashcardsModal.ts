/**
 * Missing Flashcards Modal
 * Displays notes with #mind/concept, #mind/zettel, #mind/application, or #mind/protocol
 * tags that don't have flashcards yet
 */
import { App, TFile, normalizePath } from "obsidian";
import { FLASHCARD_CONFIG } from "../../constants";
import { FlashcardManager } from "../../services/flashcard.service";
import { BaseModal } from "./BaseModal";

export interface MissingFlashcardsResult {
	cancelled: boolean;
	selectedNotePath: string | null;
}

export interface NoteWithMissingFlashcards {
	file: TFile;
	tagType: "concept" | "zettel" | "application" | "protocol";
	tagDisplay: string;
}

// Target tags that require flashcards
const TARGET_TAGS = [
	{ tag: "mind/concept", type: "concept" as const, display: "Concept" },
	{ tag: "mind/zettel", type: "zettel" as const, display: "Zettel" },
	{ tag: "mind/application", type: "application" as const, display: "Application" },
	{ tag: "mind/protocol", type: "protocol" as const, display: "Protocol" },
];

export interface MissingFlashcardsModalOptions {
	flashcardsFolder: string;
}

/**
 * Modal for displaying notes that need flashcards
 */
export class MissingFlashcardsModal extends BaseModal {
	private flashcardManager: FlashcardManager;
	private options: MissingFlashcardsModalOptions;
	private resolvePromise: ((result: MissingFlashcardsResult) => void) | null = null;
	private hasSelected = false;

	// Search and filter state
	private searchQuery = "";
	private activeTagFilter: string | null = null;
	private noteListEl: HTMLElement | null = null;
	private filterButtonsEl: HTMLElement | null = null;
	private summaryEl: HTMLElement | null = null;

	// Cached scan results
	private allMissingNotes: NoteWithMissingFlashcards[] = [];
	private isLoading = true;

	constructor(
		app: App,
		flashcardManager: FlashcardManager,
		options: MissingFlashcardsModalOptions
	) {
		super(app, {
			title: "Missing Flashcards",
			width: "550px",
		});
		this.flashcardManager = flashcardManager;
		this.options = options;
	}

	/**
	 * Open modal and return promise with selection result
	 */
	async openAndWait(): Promise<MissingFlashcardsResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-missing-flashcards-modal");

		// Start scanning vault asynchronously
		void this.loadMissingNotes();
	}

	protected renderBody(container: HTMLElement): void {
		// Summary section (will be updated after scan)
		this.summaryEl = container.createDiv({ cls: "episteme-missing-summary" });
		this.renderSummary();

		// Tag filter buttons
		this.renderTagFilters(container);

		// Search input
		this.renderSearchInput(container);

		// Note list
		this.noteListEl = container.createDiv({ cls: "episteme-note-list episteme-missing-note-list" });
		this.renderNoteList();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();

		if (!this.hasSelected && this.resolvePromise) {
			this.resolvePromise({ cancelled: true, selectedNotePath: null });
			this.resolvePromise = null;
		}
	}

	/**
	 * Load missing notes from vault
	 */
	private async loadMissingNotes(): Promise<void> {
		this.isLoading = true;
		this.renderNoteList();

		this.allMissingNotes = await this.scanForMissingFlashcards();

		this.isLoading = false;
		this.renderSummary();
		this.renderNoteList();
	}

	/**
	 * Scan vault for notes with target tags that lack flashcards
	 */
	private async scanForMissingFlashcards(): Promise<NoteWithMissingFlashcards[]> {
		const missing: NoteWithMissingFlashcards[] = [];
		const allFiles = this.app.vault.getMarkdownFiles();

		// Normalize flashcard folder path for comparison
		const flashcardFolderNormalized = normalizePath(this.options.flashcardsFolder);

		// Filter out flashcard files
		const sourceFiles = allFiles.filter((file) => {
			if (file.path.startsWith(flashcardFolderNormalized + "/")) {
				return false;
			}
			if (file.name.startsWith(FLASHCARD_CONFIG.filePrefix)) {
				return false;
			}
			return true;
		});

		for (const file of sourceFiles) {
			// Check if file has any target tag
			const tagInfo = this.getTargetTagType(file);
			if (!tagInfo) continue;

			// Check if flashcards exist
			const flashcardInfo = await this.flashcardManager.getFlashcardInfo(file);
			if (!flashcardInfo.exists || flashcardInfo.cardCount === 0) {
				missing.push({
					file,
					tagType: tagInfo.type,
					tagDisplay: tagInfo.display,
				});
			}
		}

		// Sort by tag type, then by name
		const tagOrder = { concept: 0, zettel: 1, application: 2, protocol: 3 };
		return missing.sort((a, b) => {
			const orderDiff = tagOrder[a.tagType] - tagOrder[b.tagType];
			if (orderDiff !== 0) return orderDiff;
			return a.file.basename.localeCompare(b.file.basename);
		});
	}

	/**
	 * Check if a file has any of the target tags
	 */
	private getTargetTagType(
		file: TFile
	): { tag: string; type: "concept" | "zettel" | "application" | "protocol"; display: string } | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return null;

		// Check frontmatter tags
		const frontmatterTags = cache.frontmatter?.tags ?? [];
		const normalizedFm = Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];

		for (const target of TARGET_TAGS) {
			if (
				normalizedFm.some(
					(t: string) => t === target.tag || t === `#${target.tag}`
				)
			) {
				return target;
			}
		}

		// Check inline tags
		const inlineTags = cache.tags ?? [];
		for (const target of TARGET_TAGS) {
			if (inlineTags.some((t) => t.tag === `#${target.tag}`)) {
				return target;
			}
		}

		return null;
	}

	/**
	 * Render summary showing count of missing flashcards
	 */
	private renderSummary(): void {
		if (!this.summaryEl) return;
		this.summaryEl.empty();

		if (this.isLoading) {
			this.summaryEl.createDiv({
				text: "Scanning vault...",
				cls: "episteme-missing-label",
			});
			return;
		}

		const count = this.allMissingNotes.length;
		this.summaryEl.createDiv({
			text: count.toString(),
			cls: "episteme-missing-count",
		});
		this.summaryEl.createDiv({
			text: count === 1 ? "note needs flashcards" : "notes need flashcards",
			cls: "episteme-missing-label",
		});
	}

	/**
	 * Render tag filter buttons
	 */
	private renderTagFilters(container: HTMLElement): void {
		this.filterButtonsEl = container.createDiv({ cls: "episteme-move-filters" });

		const filters = [
			{ label: "All", tag: null },
			{ label: "Concepts", tag: "concept" },
			{ label: "Zettels", tag: "zettel" },
			{ label: "Applications", tag: "application" },
			{ label: "Protocols", tag: "protocol" },
		];

		for (const filter of filters) {
			const btn = this.filterButtonsEl.createEl("button", {
				text: filter.label,
				cls: `episteme-filter-btn ${this.activeTagFilter === filter.tag ? "active" : ""}`,
			});
			btn.addEventListener("click", () => {
				this.activeTagFilter = filter.tag;
				this.updateFilterButtons();
				this.renderNoteList();
			});
		}
	}

	/**
	 * Update filter button active states
	 */
	private updateFilterButtons(): void {
		if (!this.filterButtonsEl) return;

		const buttons = this.filterButtonsEl.querySelectorAll(".episteme-filter-btn");
		const filters = [null, "concept", "zettel", "application", "protocol"];

		buttons.forEach((btn, index) => {
			if (filters[index] === this.activeTagFilter) {
				btn.addClass("active");
			} else {
				btn.removeClass("active");
			}
		});
	}

	/**
	 * Render search input
	 */
	private renderSearchInput(container: HTMLElement): void {
		const searchContainer = container.createDiv({ cls: "episteme-search-container" });

		const searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search notes...",
			cls: "episteme-search-input",
		});

		searchInput.addEventListener("input", (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this.renderNoteList();
		});

		// Focus search input
		setTimeout(() => searchInput.focus(), 50);
	}

	/**
	 * Render the list of notes
	 */
	private renderNoteList(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		if (this.isLoading) {
			this.noteListEl.createEl("div", {
				text: "Scanning vault for notes missing flashcards...",
				cls: "episteme-note-list-empty",
			});
			return;
		}

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			const emptyText = this.activeTagFilter
				? `No notes missing flashcards with tag ${this.activeTagFilter}.`
				: this.searchQuery
					? "No notes found matching your search."
					: "All notes have flashcards! Great job!";
			this.noteListEl.createEl("div", {
				text: emptyText,
				cls: "episteme-note-list-empty",
			});
			return;
		}

		// Show max 50 notes to prevent performance issues
		const displayNotes = filteredNotes.slice(0, 50);

		for (const note of displayNotes) {
			this.renderNoteItem(this.noteListEl, note);
		}

		// Show "more results" message if truncated
		if (filteredNotes.length > 50) {
			this.noteListEl.createEl("div", {
				text: `Showing 50 of ${filteredNotes.length} notes. Type to search for more.`,
				cls: "episteme-note-list-more",
			});
		}
	}

	/**
	 * Render a single note item
	 */
	private renderNoteItem(container: HTMLElement, note: NoteWithMissingFlashcards): void {
		const noteEl = container.createDiv({ cls: "episteme-missing-note-item" });

		// Tag badge
		const badgeEl = noteEl.createSpan({
			cls: `episteme-tag-badge episteme-tag-badge--${note.tagType}`,
			text: note.tagDisplay,
		});

		// Note info
		const noteInfo = noteEl.createDiv({ cls: "episteme-missing-note-info" });
		noteInfo.createDiv({ cls: "episteme-missing-note-name", text: note.file.basename });

		// Folder path (if not in root)
		const folderPath = note.file.parent?.path;
		if (folderPath && folderPath !== "/") {
			noteInfo.createDiv({
				cls: "episteme-missing-note-path",
				text: folderPath,
			});
		}

		// Click handler for entire row
		noteEl.addEventListener("click", () => {
			this.selectNote(note.file.path);
		});
	}

	/**
	 * Filter notes based on search query and tag filter
	 */
	private filterNotes(): NoteWithMissingFlashcards[] {
		let notes = [...this.allMissingNotes];

		// Apply tag filter
		if (this.activeTagFilter) {
			notes = notes.filter((note) => note.tagType === this.activeTagFilter);
		}

		// Apply search filter
		if (this.searchQuery) {
			const query = this.searchQuery.toLowerCase();
			notes = notes.filter(
				(note) =>
					note.file.basename.toLowerCase().includes(query) ||
					note.file.path.toLowerCase().includes(query)
			);
		}

		return notes;
	}

	/**
	 * Select a note and close modal
	 */
	private selectNote(notePath: string): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({ cancelled: false, selectedNotePath: notePath });
			this.resolvePromise = null;
		}
		this.close();
	}
}
