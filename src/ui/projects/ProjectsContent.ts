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
	onDelete: (projectId: string) => void;
	onAddNotes: (projectId: string, projectName: string) => void;
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
			cls: "ep:flex ep:flex-col",
		});

		// Toolbar with search + new button
		this.renderToolbar();

		// Project list
		this.renderProjectList();
	}

	private renderToolbar(): void {
		const toolbar = this.element!.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1.5 ep:mb-1.5",
		});

		// Search input (simple, no icon)
		this.searchInput = toolbar.createEl("input", {
			type: "text",
			placeholder: "Search...",
			cls: "ep:flex-1 ep:py-1.5 ep:px-2.5 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-secondary ep:text-obs-normal ep:text-[13px] ep:transition-colors ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
		});
		this.searchInput.value = this.props.searchQuery;

		this.events.addEventListener(this.searchInput, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			this.props.onSearchChange(query);
		});

		// New button
		const newBtn = toolbar.createEl("button", {
			cls: "ep:inline-flex ep:items-center ep:gap-1 ep:py-1.5 ep:px-2.5 ep:border-none ep:rounded-md ep:bg-obs-modifier-hover ep:text-obs-normal ep:text-[13px] ep:font-medium ep:cursor-pointer ep:whitespace-nowrap ep:transition-colors ep:hover:bg-obs-modifier-border [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5",
		});
		setIcon(newBtn, "plus");
		newBtn.createSpan({ text: "New" });
		this.events.addEventListener(newBtn, "click", () => {
			this.props.onCreateFromNote();
		});
	}

	private renderProjectList(): void {
		const listEl = this.element!.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-2",
		});

		const emptyStateCls = "ep:text-center ep:py-6 ep:px-3 ep:text-obs-muted ep:text-[13px]";

		if (this.props.isLoading) {
			listEl.createEl("div", {
				text: "Loading projects...",
				cls: emptyStateCls,
			});
			return;
		}

		const { projectsWithCards, emptyProjects } = this.props;
		const hasProjects = projectsWithCards.length > 0 || emptyProjects.length > 0;

		if (!hasProjects && !this.props.searchQuery) {
			listEl.createEl("div", {
				text: "No projects yet. Create one to get started!",
				cls: emptyStateCls,
			});
			return;
		}

		if (!hasProjects && this.props.searchQuery) {
			listEl.createEl("div", {
				text: "No projects found matching your search.",
				cls: emptyStateCls,
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
				cls: "ep:py-2 ep:my-1 ep:text-[11px] ep:font-semibold ep:uppercase ep:text-obs-muted ep:border-t ep:border-obs-border",
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
