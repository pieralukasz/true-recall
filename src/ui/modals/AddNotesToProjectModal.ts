/**
 * Add Notes to Project Modal
 * Allows user to select orphaned notes to add to a project
 */
import { App } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";

export interface OrphanedNoteInfo {
	uid: string;
	noteName: string;
	notePath: string;
}

export interface AddNotesToProjectResult {
	cancelled: boolean;
	selectedNotes: OrphanedNoteInfo[];
}

export interface AddNotesToProjectModalOptions {
	/** Name of the project to add notes to */
	projectName: string;
	/** List of orphaned notes (notes without any projects) */
	orphanedNotes: OrphanedNoteInfo[];
}

/**
 * Modal for selecting orphaned notes to add to a project
 */
export class AddNotesToProjectModal extends BasePromiseModal<AddNotesToProjectResult> {
	private options: AddNotesToProjectModalOptions;
	private selectedNotes: Set<string> = new Set(); // Set of UIDs
	private searchQuery = "";
	private noteListEl: HTMLElement | null = null;

	constructor(app: App, options: AddNotesToProjectModalOptions) {
		super(app, {
			title: `Add notes to "${options.projectName}"`,
			width: "500px",
		});
		this.options = options;
	}

	protected getDefaultResult(): AddNotesToProjectResult {
		return { cancelled: true, selectedNotes: [] };
	}

	protected renderBody(container: HTMLElement): void {
		container.addClass("episteme-add-notes-project-modal");

		// Info text
		container.createEl("p", {
			text: "Select notes to add to this project. Only notes without any project assignment are shown.",
			cls: "episteme-modal-info",
		});

		// Search input
		this.renderSearchInput(container);

		// Note list with checkboxes
		this.noteListEl = container.createDiv({ cls: "episteme-note-list episteme-add-notes-list" });
		this.renderNoteList();

		// Action buttons
		this.renderButtons(container);
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

	private renderNoteList(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			const emptyText = this.searchQuery
				? "No notes found matching your search."
				: "No orphaned notes available.";
			this.noteListEl.createEl("div", {
				text: emptyText,
				cls: "episteme-note-list-empty",
			});
			return;
		}

		// Show all notes (they're already orphaned, so limited)
		for (const note of filteredNotes) {
			this.renderNoteItem(note);
		}
	}

	private renderNoteItem(note: OrphanedNoteInfo): void {
		if (!this.noteListEl) return;

		const itemEl = this.noteListEl.createDiv({ cls: "episteme-note-item episteme-note-checkbox-item" });

		// Checkbox
		const checkbox = itemEl.createEl("input", {
			type: "checkbox",
			cls: "episteme-note-checkbox",
		});
		checkbox.checked = this.selectedNotes.has(note.uid);

		// Note info
		const noteInfo = itemEl.createDiv({ cls: "episteme-note-info" });
		noteInfo.createSpan({ cls: "episteme-note-name", text: note.noteName });

		// Folder path
		const folderPath = note.notePath.replace(/\/[^/]+$/, "");
		if (folderPath && folderPath !== note.noteName) {
			noteInfo.createSpan({
				cls: "episteme-note-path",
				text: folderPath,
			});
		}

		// Toggle on checkbox change
		checkbox.addEventListener("change", () => {
			if (checkbox.checked) {
				this.selectedNotes.add(note.uid);
			} else {
				this.selectedNotes.delete(note.uid);
			}
		});

		// Also toggle when clicking the row
		itemEl.addEventListener("click", (e) => {
			if (e.target !== checkbox) {
				checkbox.checked = !checkbox.checked;
				if (checkbox.checked) {
					this.selectedNotes.add(note.uid);
				} else {
					this.selectedNotes.delete(note.uid);
				}
			}
		});
	}

	private filterNotes(): OrphanedNoteInfo[] {
		if (!this.searchQuery) {
			return [...this.options.orphanedNotes].sort((a, b) =>
				a.noteName.localeCompare(b.noteName)
			);
		}

		const query = this.searchQuery.toLowerCase();
		return this.options.orphanedNotes
			.filter((note) => {
				return (
					note.noteName.toLowerCase().includes(query) ||
					note.notePath.toLowerCase().includes(query)
				);
			})
			.sort((a, b) => {
				const aExact = a.noteName.toLowerCase().startsWith(query);
				const bExact = b.noteName.toLowerCase().startsWith(query);
				if (aExact && !bExact) return -1;
				if (bExact && !aExact) return 1;
				return a.noteName.localeCompare(b.noteName);
			});
	}

	private renderButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv({ cls: "episteme-modal-buttons" });

		// Cancel button
		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "episteme-btn-secondary",
		});
		cancelBtn.addEventListener("click", () => {
			this.resolve({ cancelled: true, selectedNotes: [] });
		});

		// Save button
		const saveBtn = buttonContainer.createEl("button", {
			text: "Add to Project",
			cls: "episteme-btn-primary",
		});
		saveBtn.addEventListener("click", () => {
			const selectedNotes = this.options.orphanedNotes.filter(
				(note) => this.selectedNotes.has(note.uid)
			);
			this.resolve({ cancelled: false, selectedNotes });
		});
	}
}
