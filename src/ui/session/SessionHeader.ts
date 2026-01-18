/**
 * Session Header Component
 * Displays title and selection count for the session view
 */
import { BaseComponent } from "../component.base";

export interface SessionHeaderProps {
	selectionCount: number;
}

/**
 * Session header component
 */
export class SessionHeader extends BaseComponent {
	private props: SessionHeaderProps;

	constructor(container: HTMLElement, props: SessionHeaderProps) {
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
			cls: "episteme-session-header",
		});

		const titleRow = this.element.createDiv({
			cls: "episteme-session-title-row",
		});

		// Title
		const titleEl = titleRow.createSpan({
			cls: "episteme-session-title",
		});
		titleEl.textContent = "Review Session";

		// Selection count (only show when > 0)
		if (this.props.selectionCount > 0) {
			const countEl = titleRow.createSpan({
				cls: "episteme-session-count",
			});
			countEl.textContent = `(${this.props.selectionCount} note${this.props.selectionCount > 1 ? "s" : ""} selected)`;
		}
	}

	/**
	 * Update the header with new props
	 */
	updateProps(props: Partial<SessionHeaderProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
