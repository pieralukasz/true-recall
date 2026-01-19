/**
 * Projects Content Component
 * Contains toolbar (search + new button) and project list
 */
import { setIcon, type App, type Component } from "obsidian";
import { BaseComponent } from "../component.base";
import { ProjectItem, createProjectItem } from "./ProjectItem";
import type { ProjectInfo } from "../../types";

export interface ProjectsContentProps {
	isLoading: boolean;
	projectsWithCards: ProjectInfo[];
	emptyProjects: ProjectInfo[];
	searchQuery: string;
	app: App;
	component: Component;
	onSearchChange: (query: string) => void;
	onStartReview: (projectName: string) => void;
	onDelete: (projectId: number) => void;
	onAddNotes: (projectId: number, projectName: string) => void;
	onCreateFromNote: () => void;
}

/**
 * Content component for projects view
 */
export class ProjectsContent extends BaseComponent {
	private props: ProjectsContentProps;
	private searchInput: HTMLInputElement | null = null;
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

		// Toolbar with search + new button
		this.renderToolbar();

		// Project list
		this.renderProjectList();
	}

	private renderToolbar(): void {
		const toolbar = this.element!.createDiv({
			cls: "episteme-panel-toolbar",
		});

		// Search container with icon
		const searchContainer = toolbar.createDiv({
			cls: "episteme-search-container",
		});

		const searchIcon = searchContainer.createSpan({
			cls: "episteme-search-icon",
		});
		setIcon(searchIcon, "search");

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

		// New button
		const newBtn = toolbar.createEl("button", {
			cls: "episteme-toolbar-new-btn",
		});
		newBtn.createSpan({ text: "+ New" });
		this.events.addEventListener(newBtn, "click", () => {
			this.props.onCreateFromNote();
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
			app: this.props.app,
			component: this.props.component,
			onStartReview: this.props.onStartReview,
			onDelete: this.props.onDelete,
			onAddNotes: this.props.onAddNotes,
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
