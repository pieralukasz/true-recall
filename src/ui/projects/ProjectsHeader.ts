/**
 * Projects Header Component
 * Displays compact title with refresh button
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";

export interface ProjectsHeaderProps {
	onRefresh: () => void;
}

/**
 * Header component for projects view - compact layout
 */
export class ProjectsHeader extends BaseComponent {
	private props: ProjectsHeaderProps;

	constructor(container: HTMLElement, props: ProjectsHeaderProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-panel-header",
		});

		// Title row only
		const titleRow = this.element.createDiv({
			cls: "episteme-panel-title-row",
		});

		titleRow.createSpan({
			cls: "episteme-panel-title",
			text: "Projects",
		});

		// Refresh button
		const refreshBtn = titleRow.createEl("button", {
			cls: "episteme-panel-refresh-btn clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		setIcon(refreshBtn, "refresh-cw");
		this.events.addEventListener(refreshBtn, "click", () => {
			this.props.onRefresh();
		});
	}

	updateProps(props: Partial<ProjectsHeaderProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
