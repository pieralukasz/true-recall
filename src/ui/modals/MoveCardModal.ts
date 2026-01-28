/**
 * Move Card Modal
 * Allows user to select a target note for moving flashcard(s)
 */
import { App, TFile } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";

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
export class MoveCardModal extends BasePromiseModal<MoveCardResult> {
	private options: MoveCardModalOptions;

	// Search state
	private searchQuery = "";
	private noteListEl: HTMLElement | null = null;
	private allNotes: TFile[] = [];

	// Suggested notes container
	private suggestedSectionEl: HTMLElement | null = null;

	constructor(app: App, options: MoveCardModalOptions) {
		super(app, {
			title:
				options.cardCount === 1
					? "Move flashcard to..."
					: `Move ${options.cardCount} flashcards to...`,
			width: "500px",
		});
		this.options = options;
	}

	protected getDefaultResult(): MoveCardResult {
		return { cancelled: true, targetNotePath: null };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-move-card-modal");

		// Get all valid notes (excluding flashcard files)
		this.allNotes = this.getValidNotes();
	}

	protected renderBody(container: HTMLElement): void {
		// Info text
		container.createEl("p", {
			text: "Select a note to move the flashcard(s) to. A flashcard file will be created if it doesn't exist.",
			cls: "ep:text-obs-muted ep:text-ui-small ep:mb-4",
		});

		// Search input (using base helper)
		this.createSearchInput(container, "Search notes or #tags...", (query) => {
			this.searchQuery = query;
			this.renderNoteList();
		});

		// Suggested notes section (from backlinks)
		this.suggestedSectionEl = container.createDiv({
			cls: "ep:mb-4 ep:pb-3 ep:border-b ep:border-obs-border",
		});
		this.renderSuggestedNotes();

		// Note list (using base helper)
		this.noteListEl = this.createListContainer(container);
		this.renderNoteList();
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
	 * Check if a note has any tag starting with the given prefix
	 */
	private noteHasTagPrefix(file: TFile, tagPrefix: string): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return false;

		const prefixLower = tagPrefix.toLowerCase();

		// Check frontmatter tags
		const frontmatterTags = cache.frontmatter?.tags ?? [];
		const normalizedTags = Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];

		for (const tag of normalizedTags) {
			if (typeof tag !== "string") continue;
			const normalizedTag = (tag.startsWith("#") ? tag.slice(1) : tag).toLowerCase();
			if (normalizedTag.startsWith(prefixLower)) {
				return true;
			}
		}

		// Check inline tags
		const inlineTags = cache.tags ?? [];
		return inlineTags.some(t => {
			const tagWithoutHash = t.tag.slice(1).toLowerCase();
			return tagWithoutHash.startsWith(prefixLower);
		});
	}

	private renderNoteList(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			const emptyText = this.searchQuery
				? this.searchQuery.startsWith("#")
					? `No notes found with tag ${this.searchQuery}.`
					: "No notes found matching your search."
				: "No notes available.";
			this.createEmptyState(this.noteListEl, emptyText);
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
		const notes = [...this.allNotes];

		if (!this.searchQuery) {
			// Sort by modification time (most recent first) when no search
			return notes.sort((a, b) => b.stat.mtime - a.stat.mtime);
		}

		const query = this.searchQuery.toLowerCase();

		// Tag search mode: query starts with #
		if (query.startsWith("#")) {
			const tagPrefix = query.slice(1); // Remove #
			return notes
				.filter(note => this.noteHasTagPrefix(note, tagPrefix))
				.sort((a, b) => b.stat.mtime - a.stat.mtime);
		}

		// Normal search: filter by name/path
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
		this.resolve({ cancelled: false, targetNotePath: notePath });
	}
}
