/**
 * Move Card Modal
 * Allows user to select a target note for moving flashcard(s)
 */
import { App, TFile, normalizePath } from "obsidian";
import { FLASHCARD_CONFIG } from "../../constants";
import { BaseModal } from "./BaseModal";

export interface MoveCardResult {
	cancelled: boolean;
	targetNotePath: string | null;
}

export interface MoveCardModalOptions {
	/** Number of cards being moved (for UI display) */
	cardCount: number;
	/** Current source note name (to exclude from list) */
	sourceNoteName?: string;
	/** Flashcards folder path to exclude */
	flashcardsFolder: string;
	/** Card question text (for backlink extraction) */
	cardQuestion?: string;
	/** Card answer text (for backlink extraction) */
	cardAnswer?: string;
}

/**
 * Modal for selecting target note to move flashcard(s) to
 */
export class MoveCardModal extends BaseModal {
	private options: MoveCardModalOptions;
	private resolvePromise: ((result: MoveCardResult) => void) | null = null;
	private hasSelected = false;

	// Search state
	private searchQuery = "";
	private noteListEl: HTMLElement | null = null;
	private allNotes: TFile[] = [];

	// Tag filter state
	private activeTagFilter: string | null = null;
	private filterButtonsEl: HTMLElement | null = null;

	// Source filter: notes that have source field pointing to current note
	private sourceNotes: Set<string> = new Set();
	private sourceNotesLoaded = false;

	// Suggested notes container
	private suggestedSectionEl: HTMLElement | null = null;

	constructor(app: App, options: MoveCardModalOptions) {
		super(app, {
			title: options.cardCount === 1 ? "Move flashcard to..." : `Move ${options.cardCount} flashcards to...`,
			width: "500px",
		});
		this.options = options;
	}

	/**
	 * Open modal and return promise with selection result
	 */
	async openAndWait(): Promise<MoveCardResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-move-card-modal");

		// Get all valid notes (excluding flashcard files)
		this.allNotes = this.getValidNotes();
		// Note: Source notes are loaded lazily when Source filter is clicked
	}

	protected renderBody(container: HTMLElement): void {
		// Info text
		container.createEl("p", {
			text: "Select a note to move the flashcard(s) to. A flashcard file will be created if it doesn't exist.",
			cls: "episteme-modal-info",
		});

		// Tag filter buttons
		this.renderTagFilters(container);

		// Search input
		this.renderSearchInput(container);

		// Suggested notes section (from backlinks)
		this.suggestedSectionEl = container.createDiv({ cls: "episteme-suggested-section" });
		this.renderSuggestedNotes();

		// Note list
		this.noteListEl = container.createDiv({ cls: "episteme-note-list episteme-move-note-list" });
		this.renderNoteList();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();

		if (!this.hasSelected && this.resolvePromise) {
			this.resolvePromise({ cancelled: true, targetNotePath: null });
			this.resolvePromise = null;
		}
	}

	private renderTagFilters(container: HTMLElement): void {
		this.filterButtonsEl = container.createDiv({ cls: "episteme-move-filters" });

		const filters = [
			{ label: "All", tag: null },
			{ label: "Zettels", tag: "mind/zettel" },
		];

		// Add Source filter if we have a source note name
		if (this.options.sourceNoteName) {
			filters.push({ label: "Source", tag: "__source__" });
		}

		for (const filter of filters) {
			const btn = this.filterButtonsEl.createEl("button", {
				text: filter.label,
				cls: `episteme-filter-btn ${this.activeTagFilter === filter.tag ? "active" : ""}`,
			});
			btn.addEventListener("click", () => {
				// Lazy load source notes only when Source filter is clicked
				if (filter.tag === "__source__" && !this.sourceNotesLoaded) {
					this.findSourceNotes();
					this.sourceNotesLoaded = true;
				}
				this.activeTagFilter = filter.tag;
				this.updateFilterButtons();
				this.renderNoteList();
			});
		}
	}

	private updateFilterButtons(): void {
		if (!this.filterButtonsEl) return;

		const buttons = this.filterButtonsEl.querySelectorAll(".episteme-filter-btn") as NodeListOf<HTMLButtonElement>;

		// Build filter list dynamically (must match renderTagFilters)
		const filters = [null, "mind/zettel"];
		if (this.options.sourceNoteName) {
			filters.push("__source__");
		}

		buttons.forEach((btn, index) => {
			if (index < filters.length && filters[index] === this.activeTagFilter) {
				btn.addClass("active");
			} else {
				btn.removeClass("active");
			}
		});
	}

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
	 * Extract [[NoteName]] backlinks from card question and answer
	 */
	private extractBacklinks(): string[] {
		const content = `${this.options.cardQuestion ?? ""} ${this.options.cardAnswer ?? ""}`;
		const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
		const links: string[] = [];
		let match;
		while ((match = linkRegex.exec(content)) !== null) {
			if (match[1]) links.push(match[1]);
		}
		return [...new Set(links)]; // Remove duplicates
	}

	/**
	 * Render suggested notes section based on backlinks found in card content
	 */
	private renderSuggestedNotes(): void {
		if (!this.suggestedSectionEl) return;
		this.suggestedSectionEl.empty();

		const backlinks = this.extractBacklinks();
		if (backlinks.length === 0) {
			this.suggestedSectionEl.hide();
			return;
		}

		// Find matching notes in vault
		const suggestedNotes = this.allNotes.filter(note =>
			backlinks.some(link =>
				note.basename.toLowerCase() === link.toLowerCase()
			)
		);

		if (suggestedNotes.length === 0) {
			this.suggestedSectionEl.hide();
			return;
		}

		this.suggestedSectionEl.show();
		this.suggestedSectionEl.createEl("h4", {
			text: "Suggested (from backlinks)",
			cls: "episteme-suggested-title",
		});

		for (const note of suggestedNotes) {
			this.renderNoteItem(this.suggestedSectionEl, note, true);
		}
	}

	/**
	 * Render a single note item
	 */
	private renderNoteItem(container: HTMLElement, note: TFile, isSuggested = false): void {
		const noteEl = container.createDiv({
			cls: isSuggested ? "episteme-note-item episteme-note-suggested" : "episteme-note-item",
		});

		// Note icon and name
		const noteInfo = noteEl.createDiv({ cls: "episteme-note-info" });
		noteInfo.createSpan({ cls: "episteme-note-icon", text: isSuggested ? "💡" : "📄" });
		noteInfo.createSpan({ cls: "episteme-note-name", text: note.basename });

		// Folder path (if not in root)
		const folderPath = note.parent?.path;
		if (folderPath && folderPath !== "/") {
			noteInfo.createSpan({
				cls: "episteme-note-path",
				text: folderPath,
			});
		}

		// Select button
		const selectBtn = noteEl.createEl("button", {
			text: "Select",
			cls: "episteme-note-select-btn",
		});

		selectBtn.addEventListener("click", () => {
			this.selectNote(note.path);
		});

		// Also allow clicking the whole row
		noteEl.addEventListener("click", (e) => {
			if (e.target !== selectBtn) {
				this.selectNote(note.path);
			}
		});
	}

	/**
	 * Check if a note has a specific tag (using Obsidian's metadata cache)
	 */
	private noteHasTag(file: TFile, tagToFind: string): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return false;

		// Check frontmatter tags
		const frontmatterTags = cache.frontmatter?.tags ?? [];
		const normalizedTags = Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];

		if (normalizedTags.some((t: string) => t === tagToFind || t === `#${tagToFind}`)) {
			return true;
		}

		// Check inline tags
		const inlineTags = cache.tags ?? [];
		return inlineTags.some(t => t.tag === `#${tagToFind}`);
	}

	private renderNoteList(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			let emptyText: string;
			if (this.activeTagFilter === "__source__") {
				emptyText = "No notes found with flashcards from this source note.";
			} else if (this.activeTagFilter) {
				emptyText = `No notes found with tag #${this.activeTagFilter}.`;
			} else if (this.searchQuery) {
				emptyText = "No notes found matching your search.";
			} else {
				emptyText = "No notes available.";
			}
			this.noteListEl.createEl("div", {
				text: emptyText,
				cls: "episteme-note-list-empty",
			});
			return;
		}

		// Show max 50 notes to prevent performance issues
		const displayNotes = filteredNotes.slice(0, 50);

		for (const note of displayNotes) {
			this.renderNoteItem(this.noteListEl, note, false);
		}

		// Show "more results" message if truncated
		if (filteredNotes.length > 50) {
			this.noteListEl.createEl("div", {
				text: `Showing 50 of ${filteredNotes.length} notes. Type to search for more.`,
				cls: "episteme-note-list-more",
			});
		}
	}

	private getValidNotes(): TFile[] {
		const flashcardsFolderNormalized = normalizePath(this.options.flashcardsFolder);

		return this.app.vault.getMarkdownFiles().filter((file) => {
			// Exclude flashcard files
			if (file.path.startsWith(flashcardsFolderNormalized + "/")) {
				return false;
			}
			if (file.name.startsWith(FLASHCARD_CONFIG.filePrefix)) {
				return false;
			}

			// Exclude current source note (optional)
			if (this.options.sourceNoteName && file.basename === this.options.sourceNoteName) {
				return false;
			}

			return true;
		});
	}

	private filterNotes(): TFile[] {
		let notes = [...this.allNotes];

		// Apply tag filter first
		if (this.activeTagFilter === "__source__") {
			// Source filter: show only notes that have flashcards from this source
			notes = notes.filter(note => this.sourceNotes.has(note.basename));
		} else if (this.activeTagFilter) {
			// Regular tag filter
			notes = notes.filter(note => this.noteHasTag(note, this.activeTagFilter!));
		}

		if (!this.searchQuery) {
			// Sort by modification time (most recent first) when no search
			return notes.sort((a, b) => b.stat.mtime - a.stat.mtime);
		}

		// Filter by search query
		const query = this.searchQuery.toLowerCase();
		return notes
			.filter((note) => {
				return (
					note.basename.toLowerCase().includes(query) ||
					note.path.toLowerCase().includes(query)
				);
			})
			.sort((a, b) => {
				// Prioritize exact basename matches
				const aExact = a.basename.toLowerCase().startsWith(query);
				const bExact = b.basename.toLowerCase().startsWith(query);
				if (aExact && !bExact) return -1;
				if (bExact && !aExact) return 1;
				return a.basename.localeCompare(b.basename);
			});
	}

	private selectNote(notePath: string): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({ cancelled: false, targetNotePath: notePath });
			this.resolvePromise = null;
		}
		this.close();
	}

	/**
	 * Find all notes whose frontmatter 'source' field contains current note
	 * Uses metadataCache for fast lookup (no file reads)
	 * Early exits after MAX_RESULTS for performance with large vaults
	 */
	private findSourceNotes(): void {
		const sourceNoteName = this.options.sourceNoteName;
		const MAX_RESULTS = 100; // Limit for performance

		this.sourceNotes.clear();

		if (!sourceNoteName) {
			return;
		}

		// Check each note's source field in frontmatter
		for (const note of this.allNotes) {
			// Early exit after finding enough results
			if (this.sourceNotes.size >= MAX_RESULTS) break;

			const cache = this.app.metadataCache.getFileCache(note);
			const sources = cache?.frontmatter?.source as string | string[] | undefined;

			if (!sources) continue;

			// source can be string or array (e.g., source: "[[note]]" or source: ["[[note1]]", "[[note2]]"])
			const sourceArray = Array.isArray(sources) ? sources : [sources];
			const hasSource = sourceArray.some(s =>
				typeof s === "string" && s.includes(sourceNoteName)
			);

			if (hasSource) {
				this.sourceNotes.add(note.basename);
			}
		}
	}
}
