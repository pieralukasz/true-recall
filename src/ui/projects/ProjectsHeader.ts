/**
 * Projects Header Component
 * Displays title, stats, and "New Project" button
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";

export interface ProjectsHeaderProps {
	projectCount: number;
	totalCards: number;
	totalDue: number;
	isLoading: boolean;
	onCreateFromNote: () => void;
	onRefresh: () => void;
}

/**
 * Header component for projects view
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

		// Title row
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

		// Summary section
		const summaryEl = this.element.createDiv({
			cls: "episteme-panel-summary",
		});

		if (this.props.isLoading) {
			summaryEl.createDiv({
				text: "Loading...",
				cls: "episteme-panel-label",
			});
		} else {
			summaryEl.createDiv({
				text: this.props.projectCount.toString(),
				cls: "episteme-panel-count",
			});
			const statsText = this.props.projectCount === 1
				? `project with ${this.props.totalCards} cards`
				: `projects with ${this.props.totalCards} cards`;
			summaryEl.createDiv({
				text: statsText,
				cls: "episteme-panel-label",
			});
			if (this.props.totalDue > 0) {
				summaryEl.createDiv({
					text: `(${this.props.totalDue} due)`,
					cls: "episteme-panel-label episteme-panel-due-count",
				});
			}
		}

		// New project button (creates from note)
		const actionsRow = this.element.createDiv({
			cls: "episteme-panel-actions",
		});

		const createFromNoteBtn = actionsRow.createEl("button", {
			text: "+ New Project",
			cls: "episteme-panel-action-btn episteme-btn-primary",
		});
		this.events.addEventListener(createFromNoteBtn, "click", () => {
			this.props.onCreateFromNote();
		});
	}

	updateProps(props: Partial<ProjectsHeaderProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
