/**
 * Notes Without Projects Content Component
 * Contains search input, action bar, and note list with multi-select
 */
import { setIcon, Platform } from "obsidian";
import { BaseComponent } from "../component.base";
import type { NoteWithoutProject } from "../../state/notes-without-projects.state";

export interface NotesWithoutProjectsContentProps {
	isLoading: boolean;
	notes: NoteWithoutProject[];
	searchQuery: string;
	selectedNotePaths: Set<string>;
	availableProjects: string[];
	onSearchChange: (query: string) => void;
	onToggleSelect: (notePath: string) => void;
	onSelectAll: () => void;
	onClearSelection: () => void;
	onMoveToProject: (projectName: string) => void;
	onRefresh: () => void;
	onOpenNote: (notePath: string) => void;
}

/**
 * Content component for notes without projects view
 */
export class NotesWithoutProjectsContent extends BaseComponent {
	private props: NotesWithoutProjectsContentProps;
	private searchInput: HTMLInputElement | null = null;
	private noteListContainer: HTMLElement | null = null;
	private actionBarContainer: HTMLElement | null = null;

	constructor(container: HTMLElement, props: NotesWithoutProjectsContentProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-notes-without-projects-content ep:flex ep:flex-col ep:h-full ep:gap-2",
		});

		// Section header with buttons (desktop only - on mobile actions are in "..." menu)
		if (!Platform.isMobile) {
			this.renderHeader();
			this.renderSearchInput();
		}

		// Action bar (shown when items are selected)
		this.actionBarContainer = this.element.createDiv();
		this.renderActionBar();

		// Scroll wrapper for note list
		this.noteListContainer = this.element.createDiv({
			cls: "ep:flex-1 ep:overflow-y-auto ep:min-h-0",
		});

		// Note list
		this.renderNoteList(this.noteListContainer);
	}

	private renderHeader(): void {
		const headerRow = this.element!.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between",
		});

		// Count text
		const count = this.props.notes.length;
		const countText =
			count === 1 ? "1 note without project" : `${count} notes without projects`;
		headerRow.createDiv({
			cls: "ep:text-ui-small ep:font-semibold ep:text-obs-normal",
			text: countText,
		});

		// Buttons container
		const buttonsContainer = headerRow.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1",
		});

		const iconBtnCls = "clickable-icon";

		// Refresh button
		const refreshBtn = buttonsContainer.createEl("button", {
			cls: iconBtnCls,
			attr: { "aria-label": "Refresh" },
		});
		setIcon(refreshBtn, "refresh-cw");
		this.events.addEventListener(refreshBtn, "click", () => {
			this.props.onRefresh();
		});
	}

	private renderSearchInput(): void {
		const { searchQuery, onSearchChange } = this.props;
		const searchContainer = this.element!.createDiv();
		this.searchInput = searchContainer.createEl("input", {
			cls: "ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
			type: "text",
			placeholder: "Search notes...",
		});
		this.searchInput.value = searchQuery;

		this.events.addEventListener(this.searchInput, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			onSearchChange(query);
		});
	}

	private renderActionBar(): void {
		const container = this.actionBarContainer;
		if (!container) return;

		container.empty();

		const selectedCount = this.props.selectedNotePaths.size;
		if (selectedCount === 0) return;

		const actionBar = container.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:bg-obs-modifier-hover ep:rounded-md",
		});

		// Left side: count + select all / clear buttons
		const leftSide = actionBar.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});

		// Selected count
		const countText =
			selectedCount === 1 ? "1 selected" : `${selectedCount} selected`;
		leftSide.createSpan({
			text: countText,
			cls: "ep:text-ui-small ep:text-obs-normal ep:font-medium",
		});

		// Separator
		leftSide.createSpan({
			text: "|",
			cls: "ep:text-obs-faint",
		});

		// Select all button
		const selectAllBtn = leftSide.createEl("button", {
			cls: "ep:text-ui-small ep:text-obs-link ep:hover:underline ep:cursor-pointer ep:bg-transparent ep:border-none ep:p-0",
			text: "Select all",
		});
		this.events.addEventListener(selectAllBtn, "click", () => {
			this.props.onSelectAll();
		});

		// Dot separator
		leftSide.createSpan({
			text: "\u00B7",
			cls: "ep:text-obs-muted",
		});

		// Clear button
		const clearBtn = leftSide.createEl("button", {
			cls: "ep:text-ui-small ep:text-obs-link ep:hover:underline ep:cursor-pointer ep:bg-transparent ep:border-none ep:p-0",
			text: "Clear",
		});
		this.events.addEventListener(clearBtn, "click", () => {
			this.props.onClearSelection();
		});

		// Right side: Move to dropdown
		const rightSide = actionBar.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});

		rightSide.createSpan({
			text: "Move to:",
			cls: "ep:text-ui-small ep:text-obs-muted",
		});

		// Project dropdown
		const select = rightSide.createEl("select", {
			cls: "ep:py-1 ep:px-2 ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:cursor-pointer",
		});

		// Default option
		select.createEl("option", {
			text: "Select project...",
			value: "",
		});

		// Project options
		for (const project of this.props.availableProjects) {
			select.createEl("option", {
				text: project,
				value: project,
			});
		}

		this.events.addEventListener(select, "change", (e) => {
			const projectName = (e.target as HTMLSelectElement).value;
			if (projectName) {
				this.props.onMoveToProject(projectName);
				// Reset select
				(e.target as HTMLSelectElement).value = "";
			}
		});
	}

	private renderNoteList(container: HTMLElement): void {
		const listEl = container.createDiv({
			cls: "episteme-notes-without-projects-list",
		});

		const emptyStateCls =
			"ep:text-center ep:py-8 ep:text-obs-muted ep:text-ui-small";

		if (this.props.isLoading) {
			listEl.createDiv({
				text: "Loading notes...",
				cls: emptyStateCls,
			});
			return;
		}

		const { notes, searchQuery } = this.props;

		if (notes.length === 0 && !searchQuery) {
			listEl.createDiv({
				text: "All notes belong to projects. Great job!",
				cls: emptyStateCls,
			});
			return;
		}

		if (notes.length === 0 && searchQuery) {
			listEl.createDiv({
				text: "No notes match your search",
				cls: emptyStateCls,
			});
			return;
		}

		// Render each note
		for (const note of notes) {
			this.renderNoteItem(listEl, note);
		}
	}

	private renderNoteItem(container: HTMLElement, note: NoteWithoutProject): void {
		const isSelected = this.props.selectedNotePaths.has(note.path);

		const item = container.createDiv({
			cls: `ep:flex ep:items-center ep:gap-3 ep:py-2.5 ep:px-3 ep:border-b ep:border-obs-modifier-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover${
				isSelected ? " ep:bg-obs-modifier-active-hover" : ""
			}`,
		});

		// Checkbox
		const checkbox = item.createEl("input", {
			type: "checkbox",
			cls: "ep:cursor-pointer ep:shrink-0",
		});
		checkbox.checked = isSelected;
		this.events.addEventListener(checkbox, "change", (e) => {
			e.stopPropagation();
			this.props.onToggleSelect(note.path);
		});

		// File icon
		const iconEl = item.createSpan({
			cls: "ep:text-obs-muted ep:shrink-0",
		});
		setIcon(iconEl, "file-text");

		// Note info container
		const infoContainer = item.createDiv({
			cls: "ep:flex-1 ep:min-w-0",
		});

		// Note name (clickable)
		const nameEl = infoContainer.createDiv({
			cls: "ep:text-ui-small ep:text-obs-normal ep:line-clamp-1 ep:cursor-pointer ep:hover:text-obs-link ep:hover:underline",
			text: note.name,
		});
		this.events.addEventListener(nameEl, "click", (e) => {
			e.stopPropagation();
			this.props.onOpenNote(note.path);
		});

		// Folder path hint (if in subfolder)
		const folderPath = this.getFolderPath(note.path);
		if (folderPath) {
			infoContainer.createDiv({
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:line-clamp-1",
				text: folderPath,
			});
		}

		// Click on row toggles selection
		this.events.addEventListener(item, "click", (e) => {
			// Don't toggle if clicking on the checkbox or name
			const target = e.target as HTMLElement;
			if (target.tagName === "INPUT" || target === nameEl) return;
			this.props.onToggleSelect(note.path);
		});
	}

	private getFolderPath(filePath: string): string {
		const lastSlash = filePath.lastIndexOf("/");
		if (lastSlash <= 0) return "";
		return filePath.substring(0, lastSlash);
	}

	updateProps(props: Partial<NotesWithoutProjectsContentProps>): void {
		this.props = { ...this.props, ...props };

		// Re-render the action bar
		this.renderActionBar();

		// Only re-render the note list - never destroy the input
		if (this.noteListContainer) {
			this.noteListContainer.empty();
			this.renderNoteList(this.noteListContainer);
		}
	}

	focusSearch(): void {
		setTimeout(() => this.searchInput?.focus(), 50);
	}
}
