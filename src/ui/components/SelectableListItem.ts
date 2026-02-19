import { BaseComponent } from "../component.base";

export interface SelectableListItemProps {
	renderContent: (container: HTMLElement) => void;
	renderRight?: (container: HTMLElement) => void;
	onSelect: () => void;
	selected?: boolean;
}

export class SelectableListItem extends BaseComponent {
	private props: SelectableListItemProps;
	private _selected: boolean;

	constructor(container: HTMLElement, props: SelectableListItemProps) {
		super(container);
		this.props = props;
		this._selected = props.selected ?? false;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "ep:flex ep:justify-between ep:items-center ep:py-2.5 ep:px-3 ep:rounded-md ep:mb-1 ep:cursor-pointer ep:bg-obs-secondary ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});

		if (this._selected) {
			this.element.addClass("ep-selectable-highlight");
		}

		const leftEl = this.element.createDiv({ cls: "ep:flex-1 ep:min-w-0" });
		this.props.renderContent(leftEl);

		if (this.props.renderRight) {
			const rightEl = this.element.createDiv({ cls: "ep:shrink-0" });
			this.props.renderRight(rightEl);
		}

		this.events.addEventListener(this.element, "click", () => {
			this.props.onSelect();
		});
	}

	setSelected(selected: boolean): void {
		this._selected = selected;
		if (this.element) {
			if (selected) {
				this.element.addClass("ep-selectable-highlight");
			} else {
				this.element.removeClass("ep-selectable-highlight");
			}
		}
	}

	isSelected(): boolean {
		return this._selected;
	}
}

export function createSelectableListItem(
	container: HTMLElement,
	props: SelectableListItemProps
): SelectableListItem {
	const item = new SelectableListItem(container, props);
	item.render();
	return item;
}
