/**
 * Project Item Component
 * Displays a single project with stats and actions
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";
import type { ProjectInfo } from "../../types";

export interface ProjectItemProps {
	project: ProjectInfo;
	isEditing: boolean;
	onStartReview: (projectName: string) => void;
	onEdit: (projectId: number) => void;
	onDelete: (projectId: number) => void;
	onSaveName: (projectId: number, newName: string) => void;
	onCancelEdit: () => void;
}

/**
 * Single project item component
 */
export class ProjectItem extends BaseComponent {
	private props: ProjectItemProps;
	private editInput: HTMLInputElement | null = null;

	constructor(container: HTMLElement, props: ProjectItemProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { project, isEditing } = this.props;

		this.element = this.container.createDiv({
			cls: `episteme-project-item ${project.cardCount === 0 ? "episteme-project-empty" : ""}`,
		});

		// Project icon and name row
		const nameRow = this.element.createDiv({
			cls: "episteme-project-name-row",
		});

		const iconEl = nameRow.createSpan({
			cls: "episteme-project-icon",
		});
		setIcon(iconEl, "folder");

		if (isEditing) {
			this.renderEditMode(nameRow);
		} else {
			this.renderViewMode(nameRow);
		}

		// Stats row
		const statsRow = this.element.createDiv({
			cls: "episteme-project-stats",
		});

		const cardCountText = project.cardCount === 1 ? "1 card" : `${project.cardCount} cards`;
		statsRow.createSpan({
			text: cardCountText,
			cls: "episteme-project-stat",
		});

		if (project.dueCount > 0) {
			statsRow.createSpan({
				text: ` \u2022 ${project.dueCount} due`,
				cls: "episteme-project-stat episteme-project-due",
			});
		}

		if (project.newCount > 0) {
			statsRow.createSpan({
				text: ` \u2022 ${project.newCount} new`,
				cls: "episteme-project-stat episteme-project-new",
			});
		}

		// Actions row
		const actionsRow = this.element.createDiv({
			cls: "episteme-project-actions",
		});

		// Edit button
		const editBtn = actionsRow.createEl("button", {
			cls: "episteme-project-action-btn clickable-icon",
			attr: { "aria-label": "Edit" },
		});
		setIcon(editBtn, "pencil");
		this.events.addEventListener(editBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onEdit(project.id);
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

	private renderViewMode(container: HTMLElement): void {
		const nameEl = container.createSpan({
			text: this.props.project.name,
			cls: "episteme-project-name",
		});

		// Ctrl+Click to edit
		this.events.addEventListener(nameEl, "click", (e) => {
			if (e.metaKey || e.ctrlKey) {
				e.stopPropagation();
				this.props.onEdit(this.props.project.id);
			}
		});
	}

	private renderEditMode(container: HTMLElement): void {
		this.editInput = container.createEl("input", {
			type: "text",
			cls: "episteme-project-name-input",
			value: this.props.project.name,
		});

		// Focus and select text
		setTimeout(() => {
			this.editInput?.focus();
			this.editInput?.select();
		}, 10);

		// Save on Enter, cancel on Escape
		this.events.addEventListener(this.editInput, "keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				const newName = this.editInput?.value.trim();
				if (newName && newName !== this.props.project.name) {
					this.props.onSaveName(this.props.project.id, newName);
				} else {
					this.props.onCancelEdit();
				}
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.props.onCancelEdit();
			}
		});

		// Save on blur
		this.events.addEventListener(this.editInput, "blur", () => {
			const newName = this.editInput?.value.trim();
			if (newName && newName !== this.props.project.name) {
				this.props.onSaveName(this.props.project.id, newName);
			} else {
				this.props.onCancelEdit();
			}
		});
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
