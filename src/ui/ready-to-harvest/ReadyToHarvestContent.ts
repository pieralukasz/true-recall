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
			cls: "ep:flex ep:flex-col",
		});

		// Search input
		this.renderSearchInput();

		// Note list
		this.renderNoteList();
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
				text: "Scanning vault for notes ready to harvest...",
				cls: emptyStateCls,
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
		note: NoteReadyToHarvest
	): void {
		const noteEl = container.createDiv({
			cls: "ep:flex ep:items-center ep:gap-3 ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:last:border-b-0 ep:hover:bg-obs-modifier-hover",
		});

		// Tag badge (green for "ready")
		noteEl.createSpan({
			cls: "ep:text-[10px] ep:font-semibold ep:py-0.5 ep:px-2 ep:rounded-full ep:uppercase ep:shrink-0 ep:tracking-wide ep:bg-green-500/20 ep:text-green-500",
			text: "Ready",
		});

		// Note info
		const noteInfo = noteEl.createDiv({
			cls: "ep:flex-1 ep:min-w-0",
		});
		noteInfo.createDiv({
			cls: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap ep:text-obs-normal",
			text: note.file.basename,
		});

		// Card count
		noteInfo.createDiv({
			cls: "ep:text-xs ep:text-green-500 ep:mt-0.5",
			text: `${note.cardCount} cards reviewed`,
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
