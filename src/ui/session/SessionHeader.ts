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

		// Only render if there are selections
		if (this.props.selectionCount === 0) {
			this.element = null;
			return;
		}

		this.element = this.container.createDiv({
			cls: "episteme-session-header",
		});

		const countEl = this.element.createSpan({
			cls: "episteme-session-count",
		});
		countEl.textContent = `${this.props.selectionCount} note${this.props.selectionCount > 1 ? "s" : ""} selected`;
	}

	/**
	 * Update the header with new props
	 */
	updateProps(props: Partial<SessionHeaderProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
