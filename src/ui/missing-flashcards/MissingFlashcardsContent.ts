/**
 * Missing Flashcards Content Component
 * Contains tag filters, search, and note list
 */
import { BaseComponent } from "../component.base";
import type { NoteWithMissingFlashcards } from "../../state/state.types";

export interface MissingFlashcardsContentProps {
	isLoading: boolean;
	filteredNotes: NoteWithMissingFlashcards[];
	totalCount: number;
	searchQuery: string;
	activeTagFilter: "raw" | "zettel" | null;
	onSearchChange: (query: string) => void;
	onTagFilterChange: (filter: "raw" | "zettel" | null) => void;
	onNoteSelect: (notePath: string) => void;
}

/**
 * Content component for missing flashcards view
 */
export class MissingFlashcardsContent extends BaseComponent {
	private props: MissingFlashcardsContentProps;
	private searchInput: HTMLInputElement | null = null;

	constructor(container: HTMLElement, props: MissingFlashcardsContentProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-panel-content",
		});

		// Tag filter buttons
		this.renderTagFilters();

		// Search input
		this.renderSearchInput();

		// Note list
		this.renderNoteList();
	}

	private renderTagFilters(): void {
		const filterButtonsEl = this.element!.createDiv({
			cls: "episteme-move-filters",
		});

		const filters: { label: string; tag: "raw" | "zettel" | null }[] = [
			{ label: "All", tag: null },
			{ label: "Raw", tag: "raw" },
			{ label: "Zettels", tag: "zettel" },
		];

		for (const filter of filters) {
			const btn = filterButtonsEl.createEl("button", {
				text: filter.label,
				cls: `episteme-filter-btn ${
					this.props.activeTagFilter === filter.tag ? "active" : ""
				}`,
			});
			this.events.addEventListener(btn, "click", () => {
				this.props.onTagFilterChange(filter.tag);
			});
		}
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
			cls: "episteme-panel-list",
		});

		if (this.props.isLoading) {
			noteListEl.createEl("div", {
				text: "Scanning vault for notes missing flashcards...",
				cls: "episteme-panel-list-empty",
			});
			return;
		}

		const filteredNotes = this.props.filteredNotes;

		if (filteredNotes.length === 0) {
			const emptyText = this.props.activeTagFilter
				? `No notes missing flashcards with tag ${this.props.activeTagFilter}.`
				: this.props.searchQuery
					? "No notes found matching your search."
					: "All notes have flashcards! Great job!";
			noteListEl.createEl("div", {
				text: emptyText,
				cls: "episteme-panel-list-empty",
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
				cls: "episteme-panel-list-more",
			});
		}
	}

	private renderNoteItem(
		container: HTMLElement,
		note: NoteWithMissingFlashcards
	): void {
		const noteEl = container.createDiv({
			cls: "episteme-panel-item",
		});

		// Tag badge
		noteEl.createSpan({
			cls: `episteme-tag-badge episteme-tag-badge--${note.tagType}`,
			text: note.tagDisplay,
		});

		// Note info
		const noteInfo = noteEl.createDiv({
			cls: "episteme-panel-item-info",
		});
		noteInfo.createDiv({
			cls: "episteme-panel-item-name",
			text: note.file.basename,
		});

		// Folder path (if not in root)
		const folderPath = note.file.parent?.path;
		if (folderPath && folderPath !== "/") {
			noteInfo.createDiv({
				cls: "episteme-panel-item-path",
				text: folderPath,
			});
		}

		// Click handler
		this.events.addEventListener(noteEl, "click", () => {
			this.props.onNoteSelect(note.file.path);
		});
	}

	updateProps(props: Partial<MissingFlashcardsContentProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}

	focusSearch(): void {
		setTimeout(() => this.searchInput?.focus(), 50);
	}
}
