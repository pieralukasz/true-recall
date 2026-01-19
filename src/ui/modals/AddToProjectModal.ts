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
	private newProjectInput: HTMLInputElement | null = null;
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

		// Info text
		container.createEl("p", {
			text: "Select projects for this note. Flashcards will inherit these project assignments.",
			cls: "episteme-modal-info",
		});

		// New project input
		this.renderNewProjectInput(container);

		// Divider
		container.createEl("hr", { cls: "episteme-modal-divider" });

		// Project list with checkboxes
		this.projectListEl = container.createDiv({ cls: "episteme-project-list" });
		this.renderProjectList();

		// Action buttons
		this.renderButtons(container);
	}

	private renderNewProjectInput(container: HTMLElement): void {
		const inputGroup = container.createDiv({ cls: "episteme-new-project-group" });

		const label = inputGroup.createEl("label", {
			text: "Create new project:",
			cls: "episteme-form-label",
		});

		const inputRow = inputGroup.createDiv({ cls: "episteme-new-project-row" });

		this.newProjectInput = inputRow.createEl("input", {
			type: "text",
			placeholder: "Enter project name...",
			cls: "episteme-search-input",
		});

		const addBtn = inputRow.createEl("button", {
			text: "Add",
			cls: "episteme-btn-secondary episteme-add-project-btn",
		});

		addBtn.addEventListener("click", () => this.addNewProject());

		this.newProjectInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				this.addNewProject();
			}
		});

		// Focus input on modal open
		setTimeout(() => this.newProjectInput?.focus(), 50);
	}

	private addNewProject(): void {
		let name = this.newProjectInput?.value.trim();
		if (!name) return;

		// Strip wiki link syntax: [[Note Name]] -> Note Name
		name = name.replace(/^\[\[|\]\]$/g, "").trim();
		if (!name) return;

		// Add to selected projects
		this.selectedProjects.add(name);

		// Add to available projects if not already there
		if (!this.options.availableProjects.includes(name)) {
			this.options.availableProjects.push(name);
			this.options.availableProjects.sort((a, b) => a.localeCompare(b));
		}

		// Clear input and re-render list
		if (this.newProjectInput) {
			this.newProjectInput.value = "";
		}
		this.renderProjectList();
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
				text: "No projects yet. Create one above.",
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
