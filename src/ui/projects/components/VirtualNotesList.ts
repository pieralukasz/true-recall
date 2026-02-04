import type { App, Component } from "obsidian";
import { createNoteListItem, NoteListItem } from "../../components";
import type { ProjectNoteInfo } from "../../../types";

const ITEM_HEIGHT = 52; // Height of each note item in pixels
const BUFFER_SIZE = 5; // Extra items to render above/below visible area

export interface VirtualNotesListProps {
	notes: ProjectNoteInfo[];
	selectedNotePaths: Set<string>;
	app: App;
	component: Component;
	onCheckboxChange: (notePath: string, isSelecting: boolean) => void;
	onNoteListItemCreated?: (notePath: string, item: NoteListItem) => void;
}

export class VirtualNotesList {
	private container: HTMLElement;
	private props: VirtualNotesListProps;
	private scrollContainer: HTMLElement | null = null;
	private contentContainer: HTMLElement | null = null;
	private visibleItems: Map<number, { element: HTMLElement; item: NoteListItem }> =
		new Map();
	private scrollTop = 0;
	private containerHeight = 0;
	private resizeObserver: ResizeObserver | null = null;

	constructor(container: HTMLElement, props: VirtualNotesListProps) {
		this.container = container;
		this.props = props;
	}

	render(): HTMLElement {
		// Create scroll container
		this.scrollContainer = this.container.createDiv({
			cls: "ep:overflow-y-auto ep:max-h-[400px]",
		});

		// Create content container with total height for scrollbar
		const totalHeight = this.props.notes.length * ITEM_HEIGHT;
		this.contentContainer = this.scrollContainer.createDiv({
			cls: "ep:relative",
			attr: { style: `height: ${totalHeight}px` },
		});

		// Listen to scroll events
		this.scrollContainer.addEventListener("scroll", this.onScroll);

		// Observe container size changes
		this.resizeObserver = new ResizeObserver(() => {
			this.containerHeight = this.scrollContainer?.clientHeight ?? 0;
			this.renderVisibleItems();
		});
		this.resizeObserver.observe(this.scrollContainer);

		// Initial container height
		this.containerHeight = this.scrollContainer.clientHeight;

		// Initial render
		this.renderVisibleItems();

		return this.scrollContainer;
	}

	private onScroll = (): void => {
		if (!this.scrollContainer) return;
		this.scrollTop = this.scrollContainer.scrollTop;
		this.renderVisibleItems();
	};

	private renderVisibleItems(): void {
		if (!this.contentContainer) return;

		const { notes, selectedNotePaths, app, component, onCheckboxChange } =
			this.props;

		// Calculate visible range
		const startIndex = Math.floor(this.scrollTop / ITEM_HEIGHT);
		const visibleCount = Math.ceil(this.containerHeight / ITEM_HEIGHT);

		const from = Math.max(0, startIndex - BUFFER_SIZE);
		const to = Math.min(notes.length, startIndex + visibleCount + BUFFER_SIZE);

		// Remove items outside visible range
		for (const [index, { element, item }] of this.visibleItems) {
			if (index < from || index >= to) {
				element.remove();
				item.destroy();
				this.visibleItems.delete(index);
			}
		}

		// Add items in visible range
		for (let i = from; i < to; i++) {
			if (!this.visibleItems.has(i)) {
				const note = notes[i];
				if (!note) continue;

				const top = i * ITEM_HEIGHT;
				const isSelected = selectedNotePaths.has(note.path);

				// Create wrapper div positioned absolutely
				const wrapper = this.contentContainer.createDiv({
					cls: "ep:absolute ep:left-0 ep:right-0",
					attr: { style: `top: ${top}px; height: ${ITEM_HEIGHT}px` },
				});

				const noteItem = createNoteListItem(wrapper, {
					noteName: note.name,
					notePath: note.path,
					newCount: note.newCount,
					learningCount: note.learningCount,
					dueCount: note.dueCount,
					isSelected,
					app,
					component,
					indent: true,
					onCheckboxChange: () => {
						const isSelecting = selectedNotePaths.size > 0;
						onCheckboxChange(note.path, isSelecting);
					},
				});

				this.visibleItems.set(i, { element: wrapper, item: noteItem });

				// Notify parent about created item for selection tracking
				if (this.props.onNoteListItemCreated) {
					this.props.onNoteListItemCreated(note.path, noteItem);
				}
			}
		}
	}

	updateSelection(selectedNotePaths: Set<string>): void {
		this.props.selectedNotePaths = selectedNotePaths;
		for (const [index, { item }] of this.visibleItems) {
			const note = this.props.notes[index];
			if (note) {
				const isSelected = selectedNotePaths.has(note.path);
				item.updateSelected(isSelected);
			}
		}
	}

	destroy(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		if (this.scrollContainer) {
			this.scrollContainer.removeEventListener("scroll", this.onScroll);
		}

		for (const { element, item } of this.visibleItems.values()) {
			element.remove();
			item.destroy();
		}
		this.visibleItems.clear();

		if (this.scrollContainer) {
			this.scrollContainer.remove();
			this.scrollContainer = null;
		}
		this.contentContainer = null;
	}
}
