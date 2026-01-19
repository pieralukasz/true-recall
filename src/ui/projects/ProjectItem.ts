/**
 * Project Item Component
 * Displays a single project with stats and actions
 */
import { setIcon, MarkdownRenderer, type App, type Component } from "obsidian";
import { BaseComponent } from "../component.base";
import type { ProjectInfo } from "../../types";

export interface ProjectItemProps {
	project: ProjectInfo;
	app: App;
	component: Component;
	onStartReview: (projectName: string) => void;
	onDelete: (projectId: number) => void;
	onAddNotes: (projectId: number, projectName: string) => void;
}

/**
 * Single project item component
 */
export class ProjectItem extends BaseComponent {
	private props: ProjectItemProps;

	constructor(container: HTMLElement, props: ProjectItemProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { project } = this.props;

		this.element = this.container.createDiv({
			cls: `episteme-project-item ${project.noteCount === 0 ? "episteme-project-empty" : ""}`,
		});

		// Project icon and name row
		const nameRow = this.element.createDiv({
			cls: "episteme-project-name-row",
		});

		const iconEl = nameRow.createSpan({
			cls: "episteme-project-icon",
		});
		setIcon(iconEl, "folder");

		// Project name as clickable wiki link
		const nameEl = nameRow.createSpan({ cls: "episteme-project-name" });
		void MarkdownRenderer.render(
			this.props.app,
			`[[${project.name}]]`,
			nameEl,
			"",
			this.props.component
		);

		// Handle internal link clicks
		this.events.addEventListener(nameEl, "click", (e) => {
			const target = e.target as HTMLElement;
			const linkEl = target.closest("a.internal-link");
			if (!linkEl) return;

			e.preventDefault();
			e.stopPropagation();
			const href = linkEl.getAttribute("data-href");
			if (href) {
				void this.props.app.workspace.openLinkText(href, "", false);
			}
		});

		// Stats row
		const statsRow = this.element.createDiv({
			cls: "episteme-project-stats",
		});

		const noteCountText = project.noteCount === 1 ? "1 note" : `${project.noteCount} notes`;
		statsRow.createSpan({
			text: noteCountText,
			cls: "episteme-project-stat",
		});

		const cardCountText = project.cardCount === 1 ? "1 card" : `${project.cardCount} cards`;
		statsRow.createSpan({
			text: cardCountText,
			cls: "episteme-project-stat",
		});

		if (project.dueCount > 0) {
			statsRow.createSpan({
				text: `${project.dueCount} due`,
				cls: "episteme-project-stat episteme-project-due",
			});
		}

		if (project.newCount > 0) {
			statsRow.createSpan({
				text: `${project.newCount} new`,
				cls: "episteme-project-stat episteme-project-new",
			});
		}

		// Actions row
		const actionsRow = this.element.createDiv({
			cls: "episteme-project-actions",
		});

		// Add notes button
		const addNotesBtn = actionsRow.createEl("button", {
			cls: "episteme-project-action-btn clickable-icon",
			attr: { "aria-label": "Add notes to project" },
		});
		setIcon(addNotesBtn, "plus");
		this.events.addEventListener(addNotesBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onAddNotes(project.id, project.name);
		});

		// Delete button
		const deleteBtn = actionsRow.createEl("button", {
			cls: "episteme-project-action-btn clickable-icon episteme-btn-danger-icon",
			attr: { "aria-label": "Delete" },
		});
		setIcon(deleteBtn, "trash-2");
		this.events.addEventListener(deleteBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onDelete(project.id);
		});

		// Start Review button (only if has cards)
		if (project.cardCount > 0) {
			const reviewBtn = actionsRow.createEl("button", {
				text: "Review",
				cls: "episteme-project-action-btn episteme-btn-review",
			});
			this.events.addEventListener(reviewBtn, "click", (e) => {
				e.stopPropagation();
				this.props.onStartReview(project.name);
			});
		}
	}

	updateProps(props: Partial<ProjectItemProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

/**
 * Factory function to create ProjectItem
 */
export function createProjectItem(
	container: HTMLElement,
	props: ProjectItemProps
): ProjectItem {
	const item = new ProjectItem(container, props);
	item.render();
	return item;
}
