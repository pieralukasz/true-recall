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
			cls: "ep:text-obs-muted ep:text-ui-small ep:mb-4",
		});

		// Search input (using base helper)
		this.createSearchInput(container, "Search notes...", (query) => {
			this.searchQuery = query;
			this.renderNoteList();
		});

		// Note list (using base helper)
		this.noteListEl = this.createListContainer(container);
		this.renderNoteList();
	}

	private renderNoteList(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			const emptyText = this.searchQuery
				? "No notes found matching your search."
				: "No notes available.";
			this.createEmptyState(this.noteListEl, emptyText);
			return;
		}

		// Show max 50 notes
		const displayNotes = filteredNotes.slice(0, 50);

		for (const note of displayNotes) {
			const folderPath = note.parent?.path;
			this.createListItem(
				this.noteListEl,
				{
					name: note.basename,
					description:
						folderPath && folderPath !== "/" ? folderPath : undefined,
				},
				() => this.selectNote(note)
			);
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
