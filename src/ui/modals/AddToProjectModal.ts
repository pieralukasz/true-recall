/**
 * Add to Project Modal
 * Allows user to add/remove projects from a source note
 */
import { App } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";

export interface AddToProjectResult {
	cancelled: boolean;
	projects: string[];
}

export interface AddToProjectModalOptions {
	/** All available projects in the database */
	availableProjects: string[];
	/** Currently assigned projects for this note */
	currentProjects: string[];
}

/**
 * Modal for managing project assignments for a source note
 */
export class AddToProjectModal extends BasePromiseModal<AddToProjectResult> {
	private options: AddToProjectModalOptions;
	private selectedProjects: Set<string>;
	private projectListEl: HTMLElement | null = null;

	constructor(app: App, options: AddToProjectModalOptions) {
		super(app, {
			title: "Add to Project",
			width: "400px",
		});
		this.options = options;
		this.selectedProjects = new Set(options.currentProjects);
	}

	protected getDefaultResult(): AddToProjectResult {
		return { cancelled: true, projects: [] };
	}

	protected renderBody(container: HTMLElement): void {
		container.addClass("episteme-add-project-modal");

		// Project list with checkboxes
		this.projectListEl = container.createDiv({ cls: "episteme-project-list" });
		this.renderProjectList();

		// Action buttons
		this.renderButtons(container);
	}

	private renderProjectList(): void {
		if (!this.projectListEl) return;
		this.projectListEl.empty();

		// Combine available projects with any selected projects not yet in DB
		const allProjects = [...new Set([
			...this.options.availableProjects,
			...this.selectedProjects,
		])].sort((a, b) => a.localeCompare(b));

		if (allProjects.length === 0) {
			this.projectListEl.createEl("div", {
				text: "No projects available.",
				cls: "episteme-project-list-empty",
			});
			return;
		}

		for (const projectName of allProjects) {
			this.renderProjectItem(projectName);
		}
	}

	private renderProjectItem(projectName: string): void {
		if (!this.projectListEl) return;

		const itemEl = this.projectListEl.createDiv({ cls: "episteme-project-item" });

		const checkbox = itemEl.createEl("input", {
			type: "checkbox",
			cls: "episteme-project-checkbox",
		});
		checkbox.checked = this.selectedProjects.has(projectName);

		const label = itemEl.createEl("span", {
			text: projectName,
			cls: "episteme-project-name",
		});

		// Toggle on checkbox change
		checkbox.addEventListener("change", () => {
			if (checkbox.checked) {
				this.selectedProjects.add(projectName);
			} else {
				this.selectedProjects.delete(projectName);
			}
		});

		// Also toggle when clicking the label
		label.addEventListener("click", () => {
			checkbox.checked = !checkbox.checked;
			if (checkbox.checked) {
				this.selectedProjects.add(projectName);
			} else {
				this.selectedProjects.delete(projectName);
			}
		});
	}

	private renderButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv({ cls: "episteme-modal-buttons" });

		// Cancel button
		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "episteme-btn-secondary",
		});
		cancelBtn.addEventListener("click", () => {
			this.resolve({ cancelled: true, projects: [] });
		});

		// Save button
		const saveBtn = buttonContainer.createEl("button", {
			text: "Save",
			cls: "episteme-btn-primary",
		});
		saveBtn.addEventListener("click", () => {
			this.resolve({
				cancelled: false,
				projects: [...this.selectedProjects],
			});
		});
	}
}
