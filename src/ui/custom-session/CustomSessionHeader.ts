/**
 * Custom Session Header Component
 * Displays title and selection count for the custom session view
 */
import { BaseComponent } from "../component.base";

export interface CustomSessionHeaderProps {
	selectionCount: number;
}

/**
 * Custom session header component
 */
export class CustomSessionHeader extends BaseComponent {
	private props: CustomSessionHeaderProps;

	constructor(container: HTMLElement, props: CustomSessionHeaderProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		// Clear existing element if any
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-custom-session-header",
		});

		const titleRow = this.element.createDiv({
			cls: "episteme-custom-session-title-row",
		});

		// Title
		const titleEl = titleRow.createSpan({
			cls: "episteme-custom-session-title",
		});
		titleEl.textContent = "Review Session";

		// Selection count (only show when > 0)
		if (this.props.selectionCount > 0) {
			const countEl = titleRow.createSpan({
				cls: "episteme-custom-session-count",
			});
			countEl.textContent = `(${this.props.selectionCount} note${this.props.selectionCount > 1 ? "s" : ""} selected)`;
		}
	}

	/**
	 * Update the header with new props
	 */
	updateProps(props: Partial<CustomSessionHeaderProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
