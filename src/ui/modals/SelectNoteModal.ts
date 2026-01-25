/**
 * Select Note Modal
 * Allows user to select a note from the vault
 */
import { App, TFile, normalizePath } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";

export interface SelectNoteResult {
	cancelled: boolean;
	selectedNote: TFile | null;
}

export interface SelectNoteModalOptions {
	/** Title for the modal */
	title?: string;
	/** Folder path to exclude (e.g., flashcards folder) */
	excludeFolder?: string;
	/** Exclude flashcard files */
	excludeFlashcardFiles?: boolean;
}

/**
 * Modal for selecting a note from the vault
 */
export class SelectNoteModal extends BasePromiseModal<SelectNoteResult> {
	private options: SelectNoteModalOptions;

	// Search state
	private searchQuery = "";
	private noteListEl: HTMLElement | null = null;
	private allNotes: TFile[] = [];

	constructor(app: App, options: SelectNoteModalOptions = {}) {
		super(app, {
			title: options.title ?? "Select Note",
			width: "500px",
		});
		this.options = options;
	}

	protected getDefaultResult(): SelectNoteResult {
		return { cancelled: true, selectedNote: null };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-select-note-modal");

		// Get all valid notes
		this.allNotes = this.getValidNotes();
	}

	protected renderBody(container: HTMLElement): void {
		// Info text
		container.createEl("p", {
			text: "Select a note to create a project from.",
			cls: "ep:text-obs-muted ep:text-sm ep:mb-4",
		});

		// Search input
		this.renderSearchInput(container);

		// Note list
		this.noteListEl = container.createDiv({ cls: "ep:border ep:border-obs-border ep:rounded-md ep:max-h-[350px] ep:overflow-y-auto" });
		this.renderNoteList();
	}

	private renderSearchInput(container: HTMLElement): void {
		const searchContainer = container.createDiv({ cls: "ep:mb-3" });

		const searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search notes...",
			cls: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-sm ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
		});

		searchInput.addEventListener("input", (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this.renderNoteList();
		});

		// Focus search input
		setTimeout(() => searchInput.focus(), 50);
	}

	private renderNoteList(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			const emptyText = this.searchQuery
				? "No notes found matching your search."
				: "No notes available.";
			this.noteListEl.createEl("div", {
				text: emptyText,
				cls: "ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic",
			});
			return;
		}

		// Show max 50 notes
		const displayNotes = filteredNotes.slice(0, 50);

		for (const note of displayNotes) {
			this.renderNoteItem(note);
		}

		// Show "more results" message if truncated
		if (filteredNotes.length > 50) {
			this.noteListEl.createEl("div", {
				text: `Showing 50 of ${filteredNotes.length} notes. Type to search for more.`,
				cls: "ep:p-3 ep:text-center ep:text-obs-muted ep:text-sm",
			});
		}
	}

	private renderNoteItem(note: TFile): void {
		if (!this.noteListEl) return;

		const noteEl = this.noteListEl.createDiv({ cls: "ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:group" });

		// Note icon and name
		const noteInfo = noteEl.createDiv({ cls: "ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1" });
		noteInfo.createSpan({ cls: "ep:shrink-0", text: "📄" });
		noteInfo.createSpan({ cls: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap", text: note.basename });

		// Folder path (if not in root)
		const folderPath = note.parent?.path;
		if (folderPath && folderPath !== "/") {
			noteInfo.createSpan({
				cls: "ep:text-xs ep:text-obs-muted ep:ml-2",
				text: folderPath,
			});
		}

		// Select button
		const selectBtn = noteEl.createEl("button", {
			text: "Select",
			cls: "ep:shrink-0 ep:py-1 ep:px-3 ep:rounded ep:bg-obs-interactive ep:text-white ep:border-none ep:text-xs ep:cursor-pointer ep:opacity-0 ep:group-hover:opacity-100 ep:hover:opacity-100",
		});

		selectBtn.addEventListener("click", () => {
			this.selectNote(note);
		});

		// Also allow clicking the whole row
		noteEl.addEventListener("click", (e) => {
			if (e.target !== selectBtn) {
				this.selectNote(note);
			}
		});
	}

	private getValidNotes(): TFile[] {
		const excludeFolder = this.options.excludeFolder
			? normalizePath(this.options.excludeFolder)
			: null;

		return this.app.vault.getMarkdownFiles().filter((file) => {
			// Exclude specified folder
			if (excludeFolder && file.path.startsWith(excludeFolder + "/")) {
				return false;
			}

			return true;
		});
	}

	private filterNotes(): TFile[] {
		let notes = [...this.allNotes];

		if (!this.searchQuery) {
			// Sort by modification time (most recent first)
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

	private selectNote(note: TFile): void {
		this.resolve({ cancelled: false, selectedNote: note });
	}
}
