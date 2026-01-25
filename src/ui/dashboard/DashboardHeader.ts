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
			cls: "ep:pb-4 ep:border-b ep:border-obs-border ep:mb-4",
		});

		this.element.createSpan({
			cls: "ep:text-lg ep:font-semibold ep:text-obs-normal",
			text: "Command Dashboard",
		});
	}
}
