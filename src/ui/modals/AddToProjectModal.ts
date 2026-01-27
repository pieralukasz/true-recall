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
		// Project list with checkboxes (using base helper)
		this.projectListEl = this.createListContainer(container, "280px");
		this.renderProjectList();

		// Action buttons (using base helper)
		this.createButtonsSection(container, [
			{
				text: "Cancel",
				type: "secondary",
				onClick: () => this.resolve({ cancelled: true, projects: [] }),
			},
			{
				text: "Save",
				type: "primary",
				onClick: () =>
					this.resolve({
						cancelled: false,
						projects: [...this.selectedProjects],
					}),
			},
		]);
	}

	private renderProjectList(): void {
		if (!this.projectListEl) return;
		this.projectListEl.empty();

		// Combine available projects with any selected projects not yet in DB
		const allProjects = [
			...new Set([
				...this.options.availableProjects,
				...this.selectedProjects,
			]),
		].sort((a, b) => a.localeCompare(b));

		if (allProjects.length === 0) {
			this.createEmptyState(this.projectListEl, "No projects available.");
			return;
		}

		for (const projectName of allProjects) {
			this.renderProjectItem(projectName);
		}
	}

	private renderProjectItem(projectName: string): void {
		if (!this.projectListEl) return;

		const isChecked = this.selectedProjects.has(projectName);
		const baseCls = "ep:flex ep:items-center ep:gap-2.5 ep:py-2 ep:px-2.5 ep:border-b ep:border-obs-border ep:transition-colors ep:last:border-b-0 ep:hover:bg-obs-secondary";
		const checkedCls = isChecked ? "ep:bg-obs-interactive/10 ep:border-l-[3px] ep:border-l-obs-interactive ep:pl-[7px]" : "";
		const itemEl = this.projectListEl.createDiv({ cls: `project-item ${baseCls} ${checkedCls}` });

		const checkbox = itemEl.createEl("input", {
			type: "checkbox",
			cls: "ep:w-4 ep:h-4 ep:shrink-0 ep:cursor-pointer ep:accent-obs-interactive",
		});
		checkbox.checked = isChecked;

		const label = itemEl.createEl("span", {
			text: projectName,
			cls: "ep:flex-1 ep:text-ui-small ep:font-medium ep:cursor-pointer ep:text-obs-normal",
		});

		// Toggle on checkbox change
		checkbox.addEventListener("change", () => {
			if (checkbox.checked) {
				this.selectedProjects.add(projectName);
				itemEl.classList.add("ep:bg-obs-interactive/10", "ep:border-l-[3px]", "ep:border-l-obs-interactive", "ep:pl-[7px]");
			} else {
				this.selectedProjects.delete(projectName);
				itemEl.classList.remove("ep:bg-obs-interactive/10", "ep:border-l-[3px]", "ep:border-l-obs-interactive", "ep:pl-[7px]");
			}
		});

		// Also toggle when clicking the label
		label.addEventListener("click", () => {
			checkbox.checked = !checkbox.checked;
			checkbox.dispatchEvent(new Event("change"));
		});
	}

}
