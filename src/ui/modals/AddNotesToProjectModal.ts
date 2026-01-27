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
		// Info text
		container.createEl("p", {
			text: "Select notes to add to this project. Only notes without any project assignment are shown.",
			cls: "ep:text-obs-muted ep:text-ui-small ep:mb-4",
		});

		// Search input (using base helper)
		this.createSearchInput(container, "Search notes...", (query) => {
			this.searchQuery = query;
			this.renderNoteList();
		});

		// Note list with checkboxes (using base helper)
		this.noteListEl = this.createListContainer(container);
		this.renderNoteList();

		// Action buttons (using base helper)
		this.createButtonsSection(container, [
			{
				text: "Cancel",
				type: "secondary",
				onClick: () => this.resolve({ cancelled: true, selectedNotes: [] }),
			},
			{
				text: "Add to Project",
				type: "primary",
				onClick: () => {
					const selectedNotes = this.options.orphanedNotes.filter((note) =>
						this.selectedNotes.has(note.uid)
					);
					this.resolve({ cancelled: false, selectedNotes });
				},
			},
		]);
	}

	private renderNoteList(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			const emptyText = this.searchQuery
				? "No notes found matching your search."
				: "No orphaned notes available.";
			this.createEmptyState(this.noteListEl, emptyText);
			return;
		}

		// Show all notes (they're already orphaned, so limited)
		for (const note of filteredNotes) {
			this.renderNoteItem(note);
		}
	}

	private renderNoteItem(note: OrphanedNoteInfo): void {
		if (!this.noteListEl) return;

		const itemEl = this.noteListEl.createDiv({ cls: "ep:flex ep:items-center ep:gap-2.5 ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0" });

		// Checkbox
		const checkbox = itemEl.createEl("input", {
			type: "checkbox",
			cls: "ep:w-4 ep:h-4 ep:shrink-0 ep:cursor-pointer ep:accent-obs-interactive",
		});
		checkbox.checked = this.selectedNotes.has(note.uid);

		// Note info
		const noteInfo = itemEl.createDiv({ cls: "ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1" });
		noteInfo.createSpan({ cls: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap", text: note.noteName });

		// Folder path
		const folderPath = note.notePath.replace(/\/[^/]+$/, "");
		if (folderPath && folderPath !== note.noteName) {
			noteInfo.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:ml-2",
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

}
