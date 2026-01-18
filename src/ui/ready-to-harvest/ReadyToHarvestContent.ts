/**
 * Ready to Harvest Content Component
 * Contains search and note list
 */
import { TFile } from "obsidian";
import { BaseComponent } from "../component.base";
import type { NoteReadyToHarvest } from "../../state/state.types";

export interface ReadyToHarvestContentProps {
	isLoading: boolean;
	filteredNotes: NoteReadyToHarvest[];
	totalCount: number;
	searchQuery: string;
	onSearchChange: (query: string) => void;
	onNoteSelect: (file: TFile) => void;
}

/**
 * Content component for ready to harvest view
 */
export class ReadyToHarvestContent extends BaseComponent {
	private props: ReadyToHarvestContentProps;
	private searchInput: HTMLInputElement | null = null;

	constructor(container: HTMLElement, props: ReadyToHarvestContentProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-ready-harvest-content",
		});

		// Search input
		this.renderSearchInput();

		// Note list
		this.renderNoteList();
	}

	private renderSearchInput(): void {
		const searchContainer = this.element!.createDiv({
			cls: "episteme-search-container",
		});

		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search notes...",
			cls: "episteme-search-input",
		});
		this.searchInput.value = this.props.searchQuery;

		this.events.addEventListener(this.searchInput, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			this.props.onSearchChange(query);
		});
	}

	private renderNoteList(): void {
		const noteListEl = this.element!.createDiv({
			cls: "episteme-note-list episteme-ready-note-list",
		});

		if (this.props.isLoading) {
			noteListEl.createEl("div", {
				text: "Scanning vault for notes ready to harvest...",
				cls: "episteme-note-list-empty",
			});
			return;
		}

		const filteredNotes = this.props.filteredNotes;

		if (filteredNotes.length === 0) {
			const emptyText = this.props.searchQuery
				? "No notes found matching your search."
				: "No notes ready to harvest. Keep reviewing!";
			noteListEl.createEl("div", {
				text: emptyText,
				cls: "episteme-note-list-empty",
			});
			return;
		}

		// Show max 50 notes
		const displayNotes = filteredNotes.slice(0, 50);

		for (const note of displayNotes) {
			this.renderNoteItem(noteListEl, note);
		}

		// Show "more results" message if truncated
		if (filteredNotes.length > 50) {
			noteListEl.createEl("div", {
				text: `Showing 50 of ${filteredNotes.length} notes. Type to search for more.`,
				cls: "episteme-note-list-more",
			});
		}
	}

	private renderNoteItem(
		container: HTMLElement,
		note: NoteReadyToHarvest
	): void {
		const noteEl = container.createDiv({
			cls: "episteme-ready-note-item",
		});

		// Tag badge (green for "ready")
		noteEl.createSpan({
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

		// Click handler
		this.events.addEventListener(noteEl, "click", () => {
			this.props.onNoteSelect(note.file);
		});
	}

	updateProps(props: Partial<ReadyToHarvestContentProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}

	focusSearch(): void {
		setTimeout(() => this.searchInput?.focus(), 50);
	}
}
