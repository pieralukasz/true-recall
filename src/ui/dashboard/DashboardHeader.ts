/**
 * Dashboard Header Component
 * Displays the dashboard title
 */
import { BaseComponent } from "../component.base";

/**
 * Header component for dashboard view
 */
export class DashboardHeader extends BaseComponent {
	constructor(container: HTMLElement) {
		super(container);
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-dashboard-header",
		});

		this.element.createSpan({
			cls: "episteme-dashboard-title",
			text: "Command Dashboard",
		});
	}
}
