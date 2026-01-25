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
			cls: "ep:flex ep:flex-col",
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
			cls: "ep:flex ep:gap-2 ep:mb-3",
		});

		const filters: { label: string; tag: "raw" | "zettel" | null }[] = [
			{ label: "All", tag: null },
			{ label: "Raw", tag: "raw" },
			{ label: "Zettels", tag: "zettel" },
		];

		const baseBtnCls = "ep:py-1.5 ep:px-3 ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:cursor-pointer ep:text-[13px] ep:transition-all ep:hover:bg-obs-modifier-hover";
		const activeBtnCls = "ep:bg-obs-interactive ep:text-on-accent ep:border-obs-interactive";

		for (const filter of filters) {
			const isActive = this.props.activeTagFilter === filter.tag;
			const btn = filterButtonsEl.createEl("button", {
				text: filter.label,
				cls: `${baseBtnCls} ${isActive ? activeBtnCls : ""}`,
			});
			this.events.addEventListener(btn, "click", () => {
				this.props.onTagFilterChange(filter.tag);
			});
		}
	}

	private renderSearchInput(): void {
		const searchContainer = this.element!.createDiv({
			cls: "ep:mb-3",
		});

		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search notes...",
			cls: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-sm ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
		});
		this.searchInput.value = this.props.searchQuery;

		this.events.addEventListener(this.searchInput, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			this.props.onSearchChange(query);
		});
	}

	private renderNoteList(): void {
		const noteListEl = this.element!.createDiv({
			cls: "ep:flex ep:flex-col ep:border ep:border-obs-border ep:rounded-md",
		});

		const emptyStateCls = "ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic";

		if (this.props.isLoading) {
			noteListEl.createEl("div", {
				text: "Scanning vault for notes missing flashcards...",
				cls: emptyStateCls,
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
				cls: emptyStateCls,
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
				cls: "ep:p-3 ep:text-center ep:text-obs-muted ep:text-xs ep:italic",
			});
		}
	}

	private renderNoteItem(
		container: HTMLElement,
		note: NoteWithMissingFlashcards
	): void {
		const noteEl = container.createDiv({
			cls: "ep:flex ep:items-center ep:gap-3 ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:last:border-b-0 ep:hover:bg-obs-modifier-hover",
		});

		// Tag badge - different colors for raw vs zettel
		const badgeColorCls = note.tagType === "raw"
			? "ep:bg-green-500/20 ep:text-green-500"
			: "ep:bg-blue-500/20 ep:text-blue-500";
		noteEl.createSpan({
			cls: `ep:text-[10px] ep:font-semibold ep:py-0.5 ep:px-2 ep:rounded-full ep:uppercase ep:shrink-0 ep:tracking-wide ${badgeColorCls}`,
			text: note.tagDisplay,
		});

		// Note info
		const noteInfo = noteEl.createDiv({
			cls: "ep:flex-1 ep:min-w-0",
		});
		noteInfo.createDiv({
			cls: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap ep:text-obs-normal",
			text: note.file.basename,
		});

		// Folder path (if not in root)
		const folderPath = note.file.parent?.path;
		if (folderPath && folderPath !== "/") {
			noteInfo.createDiv({
				cls: "ep:text-[11px] ep:text-obs-muted ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap ep:mt-0.5",
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
