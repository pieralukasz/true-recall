/**
 * Ready to Harvest Modal
 * Displays notes with #mind/raw tag where all flashcards have been reviewed (no State.New cards)
 */
import { App, TFile, normalizePath } from "obsidian";
import { FLASHCARD_CONFIG } from "../../constants";
import { FlashcardManager } from "../../services";
import { BaseModal } from "./BaseModal";
import { State } from "ts-fsrs";

/**
 * Check if a file is a flashcard file based on naming pattern
 * Supports both legacy (flashcards_*) and UID-based (8-hex-chars) naming
 */
function isFlashcardFileByName(fileName: string): boolean {
	// Legacy: starts with "flashcards_"
	if (fileName.startsWith(FLASHCARD_CONFIG.filePrefix)) {
		return true;
	}
	// New: 8-char hex UID pattern (fileName includes .md extension)
	const uidPattern = new RegExp(
		`^[a-f0-9]{${FLASHCARD_CONFIG.uidLength}}\\.md$`,
		"i"
	);
	return uidPattern.test(fileName);
}

export interface NoteReadyToHarvest {
	file: TFile;
	cardCount: number;
}

export interface ReadyToHarvestModalOptions {
	flashcardsFolder: string;
	excludedFolders: string[];
}

/**
 * Modal for displaying notes that are ready to harvest
 * (all flashcards reviewed, no State.New cards)
 */
export class ReadyToHarvestModal extends BaseModal {
	private flashcardManager: FlashcardManager;
	private frontmatterService: FlashcardManager["frontmatterService"];
	private options: ReadyToHarvestModalOptions;

	// Search state
	private searchQuery = "";
	private noteListEl: HTMLElement | null = null;
	private summaryEl: HTMLElement | null = null;

	// Cached scan results
	private allReadyNotes: NoteReadyToHarvest[] = [];
	private isLoading = true;

	constructor(
		app: App,
		flashcardManager: FlashcardManager,
		frontmatterService: FlashcardManager["frontmatterService"],
		options: ReadyToHarvestModalOptions
	) {
		super(app, {
			title: "Ready to Harvest",
			width: "550px",
		});
		this.flashcardManager = flashcardManager;
		this.frontmatterService = frontmatterService;
		this.options = options;
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-ready-harvest-modal");

		// Start scanning vault asynchronously
		void this.loadReadyNotes();
	}

	protected renderBody(container: HTMLElement): void {
		// Summary section (will be updated after scan)
		this.summaryEl = container.createDiv({
			cls: "episteme-ready-summary",
		});
		this.renderSummary();

		// Search input
		this.renderSearchInput(container);

		// Note list
		this.noteListEl = container.createDiv({
			cls: "episteme-note-list episteme-ready-note-list",
		});
		this.renderNoteList();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Load ready notes from vault
	 */
	private async loadReadyNotes(): Promise<void> {
		this.isLoading = true;
		this.renderNoteList();

		this.allReadyNotes = await this.scanForReadyToHarvestNotes();

		this.isLoading = false;
		this.renderSummary();
		this.renderNoteList();
	}

	/**
	 * Scan vault for notes with #mind/raw tag where all cards are reviewed
	 */
	private async scanForReadyToHarvestNotes(): Promise<
		NoteReadyToHarvest[]
	> {
		const ready: NoteReadyToHarvest[] = [];
		const allFiles = this.app.vault.getMarkdownFiles();

		// Normalize flashcard folder path for comparison
		const flashcardFolderNormalized = normalizePath(
			this.options.flashcardsFolder
		);

		// Filter out flashcard files and excluded folders
		const sourceFiles = allFiles.filter((file) => {
			// Exclude flashcard folder
			if (file.path.startsWith(flashcardFolderNormalized + "/")) {
				return false;
			}
			// Exclude configured folders
			for (const excludedFolder of this.options.excludedFolders) {
				const normalizedExcluded = normalizePath(excludedFolder);
				if (
					file.path.startsWith(normalizedExcluded + "/") ||
					file.path === normalizedExcluded
				) {
					return false;
				}
			}
			// Exclude flashcard files by name
			if (isFlashcardFileByName(file.name)) {
				return false;
			}
			return true;
		});

		for (const file of sourceFiles) {
			// Check if file has #mind/raw tag (ONLY this tag, not others)
			if (!this.hasMindRawTag(file)) continue;

			// Get source UID
			const sourceUid = await this.frontmatterService.getSourceNoteUid(file);
			if (!sourceUid) continue;

			// Get all flashcards for this note
			const cards = this.flashcardManager.getFlashcardsBySourceUid(sourceUid);

			// Check if cards exist AND if ALL cards are reviewed (NOT State.New)
			if (cards.length > 0 && this.areAllCardsReviewed(cards)) {
				ready.push({
					file,
					cardCount: cards.length,
				});
			}
		}

		// Sort by file name
		return ready.sort((a, b) =>
			a.file.basename.localeCompare(b.file.basename)
		);
	}

	/**
	 * Check if a file has the #mind/raw tag
	 * IMPORTANT: Only checks for #mind/raw, not #mind/zettel or other tags
	 */
	private hasMindRawTag(file: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return false;

		const frontmatterTags: unknown = cache.frontmatter?.tags ?? [];
		const normalizedFm = Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];

		// Check for #mind/raw specifically (not other mind/* tags)
		const hasRawTag = normalizedFm.some(
			(t: string) => t === "mind/raw" || t === "#mind/raw"
		);

		if (hasRawTag) return true;

		// Check inline tags
		const inlineTags = cache.tags ?? [];
		return inlineTags.some((t) => t.tag === "#mind/raw");
	}

	/**
	 * Check if all cards are reviewed (no State.New cards)
	 * State enum: 0=New, 1=Learning, 2=Review, 3=Relearning
	 */
	private areAllCardsReviewed(cards: ReturnType<typeof this.flashcardManager.getFlashcardsBySourceUid>): boolean {
		// Return true if NO cards are in State.New
		return !cards.some((card) => card.fsrs.state === State.New);
	}

	/**
	 * Render summary showing count of ready notes
	 */
	private renderSummary(): void {
		if (!this.summaryEl) return;
		this.summaryEl.empty();

		if (this.isLoading) {
			this.summaryEl.createDiv({
				text: "Scanning vault...",
				cls: "episteme-ready-label",
			});
			return;
		}

		const count = this.allReadyNotes.length;
		this.summaryEl.createDiv({
			text: count.toString(),
			cls: "episteme-ready-count",
		});
		this.summaryEl.createDiv({
			text:
				count === 1 ? "note ready to harvest" : "notes ready to harvest",
			cls: "episteme-ready-label",
		});
	}

	/**
	 * Render search input
	 */
	private renderSearchInput(container: HTMLElement): void {
		const searchContainer = container.createDiv({
			cls: "episteme-search-container",
		});

		const searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search notes...",
			cls: "episteme-search-input",
		});

		searchInput.addEventListener("input", (e) => {
			this.searchQuery = (
				e.target as HTMLInputElement
			).value.toLowerCase();
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
				text: "Scanning vault for notes ready to harvest...",
				cls: "episteme-note-list-empty",
			});
			return;
		}

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			const emptyText = this.searchQuery
				? "No notes found matching your search."
				: "No notes ready to harvest. Keep reviewing!";
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
	private renderNoteItem(
		container: HTMLElement,
		note: NoteReadyToHarvest
	): void {
		const noteEl = container.createDiv({
			cls: "episteme-ready-note-item",
		});

		// Tag badge (green for "ready")
		const badgeEl = noteEl.createSpan({
			cls: "episteme-tag-badge episteme-tag-badge--raw",
			text: "Ready",
		});

		// Note info
		const noteInfo = noteEl.createDiv({
			cls: "episteme-ready-note-info",
		});
		noteInfo.createDiv({
			cls: "episteme-ready-note-name",
			text: note.file.basename,
		});

		// Card count
		noteInfo.createDiv({
			cls: "episteme-ready-note-cards",
			text: `${note.cardCount} cards reviewed`,
		});

		// Folder path (if not in root)
		const folderPath = note.file.parent?.path;
		if (folderPath && folderPath !== "/") {
			noteInfo.createDiv({
				cls: "episteme-ready-note-path",
				text: folderPath,
			});
		}

		// Click handler for entire row
		noteEl.addEventListener("click", () => {
			this.openNote(note.file);
		});
	}

	/**
	 * Filter notes based on search query
	 */
	private filterNotes(): NoteReadyToHarvest[] {
		let notes = [...this.allReadyNotes];

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
	 * Open a note in the editor and close modal
	 */
	private openNote(file: TFile): void {
		this.app.workspace.openLinkText(file.basename, file.path);
		this.close();
	}
}
