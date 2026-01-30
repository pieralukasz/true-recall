/**
 * NoteListItem Component
 * Shared component for displaying note items with checkbox, name, and card counts
 * Used by both Session and Projects views
 */
import { MarkdownRenderer, type App, type Component } from "obsidian";
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

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { noteName, newCount, learningCount, dueCount, isSelected, indent } = this.props;
		const hasCards = newCount > 0 || learningCount > 0 || dueCount > 0;

		// Note item container
		const indentCls = indent ? "ep:pl-6" : "";
		this.element = this.container.createDiv({
			cls: `ep:flex ep:items-center ep:gap-3 ep:py-2.5 ep:px-3 ${indentCls} ep:border-b ep:border-obs-modifier-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0${
				isSelected ? " ep:bg-obs-interactive/10" : ""
			}`,
		});

		// Checkbox
		const checkbox = this.element.createEl("input", {
			type: "checkbox",
			cls: "ep:shrink-0 ep:w-4 ep:h-4",
		});
		checkbox.checked = isSelected;
		this.events.addEventListener(checkbox, "change", () => {
			this.props.onCheckboxChange();
		});

		// Content container
		const content = this.element.createDiv({
			cls: "ep:flex-1 ep:min-w-0",
		});

		// Note name (wiki link style)
		const nameEl = content.createDiv({
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal ep:leading-snug ep:line-clamp-2 [&_p]:ep:m-0 [&_p]:ep:inline [&_a.internal-link]:ep:text-obs-normal [&_a.internal-link]:ep:no-underline [&_a.internal-link:hover]:ep:text-obs-link [&_a.internal-link:hover]:ep:underline",
		});
		void MarkdownRenderer.render(
			this.props.app,
			`[[${noteName}]]`,
			nameEl,
			"",
			this.props.component
		);

		// Handle link clicks
		this.events.addEventListener(nameEl, "click", (e) => {
			const linkEl = (e.target as HTMLElement).closest("a.internal-link");
			if (linkEl) {
				e.preventDefault();
				e.stopPropagation();
				const href = linkEl.getAttribute("data-href");
				if (href) {
					if (this.props.onNavigate) {
						this.props.onNavigate(href);
					} else {
						void this.props.app.workspace.openLinkText(href, "", false);
					}
				}
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

		// Click on row toggles checkbox
		this.events.addEventListener(this.element, "click", (e) => {
			const target = e.target as HTMLElement;
			if (target.tagName !== "INPUT" && !target.closest("a")) {
				checkbox.checked = !checkbox.checked;
				this.props.onCheckboxChange();
			}
		});
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
