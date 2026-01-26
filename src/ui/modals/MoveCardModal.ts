/**
 * Move Card Modal
 * Allows user to select a target note for moving flashcard(s)
 */
import { App, TFile } from "obsidian";
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
			cls: "ep:text-obs-muted ep:text-ui-small ep:mb-4",
		});

		// Tag filter buttons
		this.renderTagFilters(container);

		// Search input
		this.renderSearchInput(container);

		// Suggested notes section (from backlinks)
		this.suggestedSectionEl = container.createDiv({
			cls: "ep:mb-4 ep:pb-3 ep:border-b ep:border-obs-border",
		});
		this.renderSuggestedNotes();

		// Note list
		this.noteListEl = container.createDiv({
			cls: "ep:border ep:border-obs-border ep:rounded-md ep:max-h-[350px] ep:overflow-y-auto",
		});
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
		this.filterButtonsEl = container.createDiv({
			cls: "ep:flex ep:gap-2 ep:mb-3",
		});

		const filters = [
			{ label: "All", tag: null },
			{ label: "Zettels", tag: "mind/zettel" },
		];

		// Add Source filter if we have a source note name
		if (this.options.sourceNoteName) {
			filters.push({ label: "Source", tag: "__source__" });
		}

		const baseBtnCls = "ep:py-1.5 ep:px-3 ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:cursor-pointer ep:text-ui-small ep:transition-all ep:hover:bg-obs-modifier-hover";
		const activeBtnCls = "ep:bg-obs-interactive ep:text-white ep:border-obs-interactive";

		for (const filter of filters) {
			const isActive = this.activeTagFilter === filter.tag;
			const btn = this.filterButtonsEl.createEl("button", {
				text: filter.label,
				cls: `filter-btn ${baseBtnCls} ${isActive ? activeBtnCls : ""}`,
				attr: { "data-tag": filter.tag ?? "all" },
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

		const buttons = this.filterButtonsEl.querySelectorAll(".filter-btn") as NodeListOf<HTMLButtonElement>;
		const activeCls = ["ep:bg-obs-interactive", "ep:text-white", "ep:border-obs-interactive"];

		buttons.forEach((btn) => {
			const tag = btn.getAttribute("data-tag");
			const isActive = (tag === "all" && this.activeTagFilter === null) ||
				tag === this.activeTagFilter;

			activeCls.forEach((cls) => btn.classList.toggle(cls, isActive));
		});
	}

	private renderSearchInput(container: HTMLElement): void {
		const searchContainer = container.createDiv({ cls: "ep:mb-3" });

		const searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search notes...",
			cls: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
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
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:m-0 ep:mb-2",
		});

		for (const note of suggestedNotes) {
			this.renderNoteItem(this.suggestedSectionEl, note, true);
		}
	}

	/**
	 * Render a single note item
	 */
	private renderNoteItem(container: HTMLElement, note: TFile, isSuggested = false): void {
		const baseCls = "ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:group";
		const suggestedCls = "ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive ep:rounded ep:mb-1";
		const noteEl = container.createDiv({
			cls: isSuggested ? `${baseCls} ${suggestedCls}` : baseCls,
		});

		// Note icon and name
		const noteInfo = noteEl.createDiv({ cls: "ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1" });
		noteInfo.createSpan({ cls: "ep:shrink-0", text: isSuggested ? "💡" : "📄" });
		noteInfo.createSpan({ cls: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap", text: note.basename });

		// Folder path (if not in root)
		const folderPath = note.parent?.path;
		if (folderPath && folderPath !== "/") {
			noteInfo.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:ml-2",
				text: folderPath,
			});
		}

		// Select button
		const selectBtn = noteEl.createEl("button", {
			text: "Select",
			cls: "ep:shrink-0 ep:py-1 ep:px-3 ep:rounded ep:bg-obs-interactive ep:text-white ep:border-none ep:text-ui-smaller ep:cursor-pointer ep:opacity-0 ep:group-hover:opacity-100 ep:hover:opacity-100",
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
				cls: "ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic",
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
				cls: "ep:p-3 ep:text-center ep:text-obs-muted ep:text-ui-small",
			});
		}
	}

	private getValidNotes(): TFile[] {
		return this.app.vault.getMarkdownFiles().filter((file) => {
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
