/**
 * Projects Content Component
 * Contains search and project list
 */
import { BaseComponent } from "../component.base";
import { ProjectItem, createProjectItem } from "./ProjectItem";
import type { ProjectInfo } from "../../types";

export interface ProjectsContentProps {
	isLoading: boolean;
	projectsWithCards: ProjectInfo[];
	emptyProjects: ProjectInfo[];
	searchQuery: string;
	editingProjectId: number | null;
	showNewProjectInput: boolean;
	onSearchChange: (query: string) => void;
	onStartReview: (projectName: string) => void;
	onEdit: (projectId: number) => void;
	onDelete: (projectId: number) => void;
	onSaveName: (projectId: number, newName: string) => void;
	onCancelEdit: () => void;
	onCreateProject: (name: string) => void;
	onCancelCreate: () => void;
}

/**
 * Content component for projects view
 */
export class ProjectsContent extends BaseComponent {
	private props: ProjectsContentProps;
	private searchInput: HTMLInputElement | null = null;
	private newProjectInput: HTMLInputElement | null = null;
	private projectItems: ProjectItem[] = [];

	constructor(container: HTMLElement, props: ProjectsContentProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		// Clean up project items
		for (const item of this.projectItems) {
			item.destroy();
		}
		this.projectItems = [];

		this.element = this.container.createDiv({
			cls: "episteme-panel-content",
		});

		// Search input
		this.renderSearchInput();

		// New project input (if visible)
		if (this.props.showNewProjectInput) {
			this.renderNewProjectInput();
		}

		// Project list
		this.renderProjectList();
	}

	private renderSearchInput(): void {
		const searchContainer = this.element!.createDiv({
			cls: "episteme-search-container",
		});

		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search projects...",
			cls: "episteme-search-input",
		});
		this.searchInput.value = this.props.searchQuery;

		this.events.addEventListener(this.searchInput, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			this.props.onSearchChange(query);
		});
	}

	private renderNewProjectInput(): void {
		const inputContainer = this.element!.createDiv({
			cls: "episteme-new-project-container",
		});

		this.newProjectInput = inputContainer.createEl("input", {
			type: "text",
			placeholder: "Enter project name...",
			cls: "episteme-new-project-input",
		});

		// Focus immediately
		setTimeout(() => {
			this.newProjectInput?.focus();
		}, 10);

		// Save on Enter, cancel on Escape
		this.events.addEventListener(this.newProjectInput, "keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				const name = this.newProjectInput?.value.trim();
				if (name) {
					this.props.onCreateProject(name);
				}
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.props.onCancelCreate();
			}
		});

		// Cancel on blur (if empty)
		this.events.addEventListener(this.newProjectInput, "blur", () => {
			const name = this.newProjectInput?.value.trim();
			if (name) {
				this.props.onCreateProject(name);
			} else {
				this.props.onCancelCreate();
			}
		});
	}

	private renderProjectList(): void {
		const listEl = this.element!.createDiv({
			cls: "episteme-panel-list",
		});

		if (this.props.isLoading) {
			listEl.createEl("div", {
				text: "Loading projects...",
				cls: "episteme-panel-list-empty",
			});
			return;
		}

		const { projectsWithCards, emptyProjects } = this.props;
		const hasProjects = projectsWithCards.length > 0 || emptyProjects.length > 0;

		if (!hasProjects && !this.props.searchQuery) {
			listEl.createEl("div", {
				text: "No projects yet. Create one to get started!",
				cls: "episteme-panel-list-empty",
			});
			return;
		}

		if (!hasProjects && this.props.searchQuery) {
			listEl.createEl("div", {
				text: "No projects found matching your search.",
				cls: "episteme-panel-list-empty",
			});
			return;
		}

		// Render projects with cards
		if (projectsWithCards.length > 0) {
			for (const project of projectsWithCards) {
				this.renderProjectItem(listEl, project);
			}
		}

		// Separator for empty projects
		if (emptyProjects.length > 0 && projectsWithCards.length > 0) {
			listEl.createEl("div", {
				cls: "episteme-project-separator",
				text: "Empty projects",
			});
		}

		// Render empty projects
		if (emptyProjects.length > 0) {
			for (const project of emptyProjects) {
				this.renderProjectItem(listEl, project);
			}
		}
	}

	private renderProjectItem(container: HTMLElement, project: ProjectInfo): void {
		const itemContainer = container.createDiv();
		const item = createProjectItem(itemContainer, {
			project,
			isEditing: this.props.editingProjectId === project.id,
			onStartReview: this.props.onStartReview,
			onEdit: this.props.onEdit,
			onDelete: this.props.onDelete,
			onSaveName: this.props.onSaveName,
			onCancelEdit: this.props.onCancelEdit,
		});
		this.projectItems.push(item);
	}

	updateProps(props: Partial<ProjectsContentProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}

	focusSearch(): void {
		setTimeout(() => this.searchInput?.focus(), 50);
	}
}
