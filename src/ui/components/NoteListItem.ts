/**
 * NoteListItem Component
 * Shared component for displaying note items with checkbox, name, and card counts
 * Used by both Session and Projects views
 */
import { type App, type Component, Platform, setIcon } from "obsidian";
import { BaseComponent } from "../component.base";
import { createCardCountDisplay } from "./CardCountDisplay";

export interface NoteListItemProps {
	noteName: string;
	notePath?: string;
	newCount: number;
	learningCount: number;
	dueCount: number;
	isSelected: boolean;
	app: App;
	component: Component;
	onCheckboxChange: () => void;
	onNavigate?: (path: string) => void;
	/** Additional left padding for nested items */
	indent?: boolean;
	/** Show drag handle for DnD (desktop only) */
	showDragHandle?: boolean;
	/** Show play and "..." action buttons */
	showActions?: boolean;
	/** Called when play button is clicked */
	onPlay?: () => void;
	/** Called when "..." button is clicked, with button position */
	onMoreMenu?: (position: { x: number; y: number }) => void;
}

/**
 * Note list item with checkbox, name link, and card counts
 */
export class NoteListItem extends BaseComponent {
	private props: NoteListItemProps;

	constructor(container: HTMLElement, props: NoteListItemProps) {
		super(container);
		this.props = props;
	}

	updateSelected(isSelected: boolean): void {
		if (this.element) {
			this.element.classList.toggle("ep:bg-obs-interactive/10", isSelected);
		}
		this.props.isSelected = isSelected;
	}

	getPath(): string | undefined {
		return this.props.notePath;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { noteName, newCount, learningCount, dueCount, isSelected, indent, showDragHandle } = this.props;
		const hasCards = newCount > 0 || learningCount > 0 || dueCount > 0;

		// Note item container
		const indentCls = indent ? "ep:pl-6" : "";
		this.element = this.container.createDiv({
			cls: `ep:group/note ep:flex ep:items-center ep:gap-3 ep:py-2 ep:px-3 ${indentCls} ep:h-full ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover${
				isSelected ? " ep:bg-obs-interactive/10" : ""
			}`,
		});

		if (showDragHandle && !Platform.isMobile) {
			const handle = this.element.createDiv({
				cls: "ep:flex ep:items-center ep:justify-center ep:w-4 ep:h-4 ep:shrink-0 ep:text-obs-faint ep:cursor-grab ep:opacity-0 ep:transition-opacity ep:group-hover/note:opacity-40 ep:hover:opacity-100 [&_svg]:ep:w-3 [&_svg]:ep:h-3",
			});
			setIcon(handle, "grip-vertical");
		}

		// File icon
		const fileIcon = this.element.createDiv({
			cls: "ep:flex ep:items-center ep:justify-center ep:w-4 ep:h-4 ep:shrink-0 ep:text-obs-muted [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5",
		});
		setIcon(fileIcon, "file-text");

		// Content container
		const content = this.element.createDiv({
			cls: "ep:flex-1 ep:min-w-0",
		});

		// Note name as clickable link (no MarkdownRenderer for performance)
		const nameEl = content.createDiv({
			cls: "ep:text-ui-small ep:font-medium ep:leading-snug ep:truncate",
		});
		const link = nameEl.createEl("a", {
			text: noteName,
			cls: "ep:text-obs-accent ep:cursor-pointer ep:no-underline ep:hover:underline ep:transition-colors ep:font-medium",
		});
		this.events.addEventListener(link, "click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (this.props.onNavigate) {
				this.props.onNavigate(noteName);
			} else {
				void this.props.app.workspace.openLinkText(noteName, "", false);
			}
		});

		// Stats with Anki-style colored counts
		const statsEl = content.createDiv({
			cls: "ep:text-ui-smaller ep:mt-0.5 ep:flex ep:items-center ep:gap-1",
		});
		if (hasCards) {
			createCardCountDisplay(statsEl, {
				newCount,
				learningCount,
				dueCount,
				variant: "full",
				size: "smaller",
				bold: true,
			});
		} else {
			statsEl.createSpan({
				text: "done",
				cls: "ep:text-obs-faint",
			});
		}

		// Action buttons (play + more)
		if (this.props.showActions) {
			const totalDue = newCount + learningCount + dueCount;
			const iconBtnCls =
				"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";

			if (totalDue > 0 && this.props.onPlay) {
				const playBtn = this.element.createEl("button", {
					cls: iconBtnCls,
					attr: { "aria-label": "Start review" },
				});
				setIcon(playBtn, "play");
				this.events.addEventListener(playBtn, "click", (e) => {
					e.stopPropagation();
					this.props.onPlay!();
				});
			}

			if (this.props.onMoreMenu) {
				const moreBtn = this.element.createEl("button", {
					cls: iconBtnCls,
					attr: { "aria-label": "More actions" },
				});
				setIcon(moreBtn, "more-horizontal");
				this.events.addEventListener(moreBtn, "click", (e) => {
					e.stopPropagation();
					const rect = moreBtn.getBoundingClientRect();
					this.props.onMoreMenu!({ x: rect.left, y: rect.bottom });
				});
			}
		}

		// Click on row toggles selection (only for notes with cards)
		if (hasCards) {
			this.events.addEventListener(this.element, "click", (e) => {
				const target = e.target as HTMLElement;
				if (target !== link) {
					this.props.onCheckboxChange();
				}
			});
		}
	}
}

/**
 * Factory function to create NoteListItem
 */
export function createNoteListItem(
	container: HTMLElement,
	props: NoteListItemProps
): NoteListItem {
	const item = new NoteListItem(container, props);
	item.render();
	return item;
}
