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

		// Stats row - inline text with · separators
		const statsRow = this.element.createDiv({
			cls: "episteme-project-stats",
		});

		const noteCountText = project.noteCount === 1 ? "1 note" : `${project.noteCount} notes`;
		statsRow.createSpan({ text: noteCountText });

		statsRow.createSpan({ text: "·", cls: "episteme-project-stat-separator" });

		const cardCountText = project.cardCount === 1 ? "1 card" : `${project.cardCount} cards`;
		statsRow.createSpan({ text: cardCountText });

		if (project.dueCount > 0) {
			statsRow.createSpan({ text: "·", cls: "episteme-project-stat-separator" });
			statsRow.createSpan({
				text: `${project.dueCount} due`,
				cls: "episteme-project-stat-due",
			});
		}

		if (project.newCount > 0) {
			statsRow.createSpan({ text: "·", cls: "episteme-project-stat-separator" });
			statsRow.createSpan({
				text: `${project.newCount} new`,
				cls: "episteme-project-stat-new",
			});
		}

		// Actions row - icon buttons left, Review right
		const actionsRow = this.element.createDiv({
			cls: "episteme-project-actions",
		});

		// Left side: icon buttons
		const actionsLeft = actionsRow.createDiv({
			cls: "episteme-project-actions-left",
		});

		// Add notes button
		const addNotesBtn = actionsLeft.createEl("button", {
			cls: "episteme-project-icon-btn clickable-icon",
			attr: { "aria-label": "Add notes to project" },
		});
		setIcon(addNotesBtn, "plus");
		this.events.addEventListener(addNotesBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onAddNotes(project.id, project.name);
		});

		// Delete button
		const deleteBtn = actionsLeft.createEl("button", {
			cls: "episteme-project-icon-btn clickable-icon episteme-btn-danger",
			attr: { "aria-label": "Delete" },
		});
		setIcon(deleteBtn, "trash-2");
		this.events.addEventListener(deleteBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onDelete(project.id);
		});

		// Spacer
		actionsRow.createDiv({ cls: "episteme-project-actions-spacer" });

		// Start Review button (only if has cards)
		if (project.cardCount > 0) {
			const reviewBtn = actionsRow.createEl("button", {
				cls: "episteme-project-review-btn",
			});
			setIcon(reviewBtn, "play");
			reviewBtn.createSpan({ text: "Review" });
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
