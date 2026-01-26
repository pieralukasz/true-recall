/**
 * Projects Content Component
 * Contains search input and project list (flat list style like SessionContent)
 */
import {
	setIcon,
	MarkdownRenderer,
	Platform,
	type App,
	type Component,
} from "obsidian";
import { BaseComponent } from "../component.base";
import type { ProjectInfo, ProjectNoteInfo } from "../../types";

export interface ProjectsContentProps {
	isLoading: boolean;
	projectsWithCards: ProjectInfo[];
	emptyProjects: ProjectInfo[];
	searchQuery: string;
	expandedProjectIds: Set<string>;
	app: App;
	component: Component;
	onSearchChange: (query: string) => void;
	onStartReview: (projectName: string) => void;
	onDelete: (projectId: string) => void;
	onAddNotes: (projectId: string, projectName: string) => void;
	onCreateFromNote: () => void;
	onRefresh: () => void;
	onToggleExpand: (projectId: string) => void;
}

/**
 * Content component for projects view
 */
export class ProjectsContent extends BaseComponent {
	private props: ProjectsContentProps;
	private searchInput: HTMLInputElement | null = null;
	private projectListContainer: HTMLElement | null = null;

	constructor(container: HTMLElement, props: ProjectsContentProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-projects-content ep:flex ep:flex-col ep:h-full ep:gap-2",
		});

		// Section header with buttons (desktop only - on mobile actions are in "..." menu)
		if (!Platform.isMobile) {
			const headerRow = this.element.createDiv({
				cls: "ep:flex ep:items-center ep:justify-between",
			});
			headerRow.createDiv({
				cls: "ep:text-ui-small ep:font-semibold ep:text-obs-normal",
				text: "Projects",
			});

			// Buttons container
			const buttonsContainer = headerRow.createDiv({
				cls: "ep:flex ep:items-center ep:gap-1",
			});

			const iconBtnCls = "clickable-icon";

			// Refresh button
			const refreshBtn = buttonsContainer.createEl("button", {
				cls: iconBtnCls,
				attr: { "aria-label": "Refresh" },
			});
			setIcon(refreshBtn, "refresh-cw");
			this.events.addEventListener(refreshBtn, "click", () => {
				this.props.onRefresh();
			});

			// New button
			const newBtn = buttonsContainer.createEl("button", {
				cls: iconBtnCls,
				attr: { "aria-label": "New project" },
			});
			setIcon(newBtn, "plus");
			this.events.addEventListener(newBtn, "click", () => {
				this.props.onCreateFromNote();
			});

			// Search input (desktop only)
			this.renderSearchInput();
		}

		// Scroll wrapper for project list
		this.projectListContainer = this.element.createDiv({
			cls: "ep:flex-1 ep:overflow-y-auto ep:min-h-0",
		});

		// Project list
		this.renderProjectList(this.projectListContainer);
	}

	private renderSearchInput(): void {
		const { searchQuery, onSearchChange } = this.props;
		const searchContainer = this.element!.createDiv();
		this.searchInput = searchContainer.createEl("input", {
			cls: "ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
			type: "text",
			placeholder: "Search projects...",
		});
		this.searchInput.value = searchQuery;

		this.events.addEventListener(this.searchInput, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			onSearchChange(query);
		});
	}

	private renderProjectList(container: HTMLElement): void {
		const listEl = container.createDiv({
			cls: "episteme-project-list",
		});

		const emptyStateCls =
			"ep:text-center ep:py-8 ep:text-obs-muted ep:text-ui-small";

		if (this.props.isLoading) {
			listEl.createDiv({
				text: "Loading projects...",
				cls: emptyStateCls,
			});
			return;
		}

		const { projectsWithCards, emptyProjects } = this.props;
		const hasProjects =
			projectsWithCards.length > 0 || emptyProjects.length > 0;

		if (!hasProjects && !this.props.searchQuery) {
			listEl.createDiv({
				text: "No projects yet. Create one to get started!",
				cls: emptyStateCls,
			});
			return;
		}

		if (!hasProjects && this.props.searchQuery) {
			listEl.createDiv({
				text: "No projects match your search",
				cls: emptyStateCls,
			});
			return;
		}

		// Render projects with cards
		for (const project of projectsWithCards) {
			this.renderProjectItem(listEl, project, false);
		}

		// Render empty projects (with separator if both exist)
		if (emptyProjects.length > 0 && projectsWithCards.length > 0) {
			listEl.createDiv({
				cls: "ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:py-3",
				text: "Empty projects",
			});
		}

		for (const project of emptyProjects) {
			this.renderProjectItem(listEl, project, true);
		}
	}

	private renderProjectItem(
		container: HTMLElement,
		project: ProjectInfo,
		isEmpty: boolean
	): void {
		const hasCards = project.cardCount > 0;
		const isExpanded = this.props.expandedProjectIds.has(project.id);

		// Project item container (flat list style)
		const item = container.createDiv({
			cls: `ep:flex ep:flex-col ep:border-b ep:border-obs-modifier-border${
				isEmpty ? " ep:opacity-60" : ""
			}`,
		});

		// Main row (always visible) - clickable for expansion
		const mainRow = item.createDiv({
			cls: "ep:flex ep:items-start ep:gap-3 ep:py-2.5 ep:px-3 ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});

		// Click handler for expand/collapse
		this.events.addEventListener(mainRow, "click", (e) => {
			// Don't trigger if clicked on action buttons
			if ((e.target as HTMLElement).closest("button")) return;
			this.props.onToggleExpand(project.id);
		});

		// Chevron icon (rotates when expanded)
		const chevronEl = mainRow.createSpan({
			cls: `ep:transition-transform ep:duration-200 ep:shrink-0 ${
				isExpanded ? "ep:rotate-90" : ""
			}`,
		});
		setIcon(chevronEl, "chevron-right");

		// Content container
		const content = mainRow.createDiv({
			cls: "ep:flex-1 ep:min-w-0",
		});

		// Project name as clickable wiki link
		const nameEl = content.createDiv({
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal ep:leading-snug ep:line-clamp-2 [&_p]:ep:m-0 [&_p]:ep:inline [&_a.internal-link]:ep:text-obs-normal [&_a.internal-link]:ep:no-underline [&_a.internal-link:hover]:ep:text-obs-link [&_a.internal-link:hover]:ep:underline",
		});
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

		// Stats line with Anki-style colored counts
		const statsEl = content.createDiv({
			cls: "ep:text-ui-smaller ep:mt-0.5 ep:flex ep:items-center ep:gap-2",
		});

		// Note count (muted)
		const noteText =
			project.noteCount === 1 ? "1 note" : `${project.noteCount} notes`;
		statsEl.createSpan({
			text: noteText,
			cls: hasCards ? "ep:text-obs-muted" : "ep:text-obs-faint",
		});

		// Anki-style card counts (New · Learning · Due)
		if (hasCards) {
			const countsEl = statsEl.createSpan({
				cls: "ep:flex ep:items-center ep:gap-1 ep:font-medium",
			});

			// New count (blue)
			countsEl.createSpan({
				text: String(project.newCount),
				cls: "ep:text-blue-500",
			});

			countsEl.createSpan({ text: "·", cls: "ep:text-obs-faint" });

			// Learning count (orange)
			countsEl.createSpan({
				text: String(project.learningCount),
				cls: "ep:text-orange-500",
			});

			countsEl.createSpan({ text: "·", cls: "ep:text-obs-faint" });

			// Due/Review count (green)
			countsEl.createSpan({
				text: String(project.dueCount),
				cls: "ep:text-green-500",
			});
		}

		// Actions container (right side)
		const actions = mainRow.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1 ep:shrink-0",
		});

		const iconBtnCls =
			"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";

		// Add notes button
		const addBtn = actions.createEl("button", {
			cls: iconBtnCls,
			attr: { "aria-label": "Add notes" },
		});
		setIcon(addBtn, "plus");
		this.events.addEventListener(addBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onAddNotes(project.id, project.name);
		});

		// Delete button
		const deleteBtn = actions.createEl("button", {
			cls: `${iconBtnCls} ep:hover:text-red-500`,
			attr: { "aria-label": "Delete" },
		});
		setIcon(deleteBtn, "trash-2");
		this.events.addEventListener(deleteBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onDelete(project.id);
		});

		// Review button (only if has cards)
		if (hasCards) {
			const reviewBtn = actions.createEl("button", {
				cls: iconBtnCls,
				attr: { "aria-label": "Start review" },
			});
			setIcon(reviewBtn, "play");
			this.events.addEventListener(reviewBtn, "click", (e) => {
				e.stopPropagation();
				this.props.onStartReview(project.name);
			});
		}

		// Expanded content (notes list)
		if (isExpanded && project.notes.length > 0) {
			this.renderNotesList(item, project.notes);
		}
	}

	private renderNotesList(
		container: HTMLElement,
		notes: ProjectNoteInfo[]
	): void {
		const notesContainer = container.createDiv({
			cls: "ep:border-t ep:border-obs-modifier-border",
		});

		for (const note of notes) {
			const noteItem = notesContainer.createDiv({
				cls: "ep:flex ep:items-center ep:gap-2 ep:py-2 ep:px-3 ep:pl-11 ep:hover:bg-obs-modifier-hover ep:transition-colors ep:cursor-pointer",
			});

			// Note icon
			const iconEl = noteItem.createSpan({
				cls: "ep:text-obs-muted",
			});
			setIcon(iconEl, "file-text");

			// Note name as clickable wiki link
			const nameEl = noteItem.createDiv({
				cls: "ep:flex-1 ep:text-ui-small ep:text-obs-normal ep:line-clamp-1 [&_p]:ep:m-0 [&_p]:ep:inline [&_a.internal-link]:ep:text-obs-normal [&_a.internal-link]:ep:no-underline [&_a.internal-link:hover]:ep:text-obs-link [&_a.internal-link:hover]:ep:underline",
			});
			void MarkdownRenderer.render(
				this.props.app,
				`[[${note.name}]]`,
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

			// Card count
			const cardCountText =
				note.cardCount === 1 ? "1 card" : `${note.cardCount} cards`;
			noteItem.createSpan({
				text: cardCountText,
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:whitespace-nowrap",
			});
		}
	}

	updateProps(props: Partial<ProjectsContentProps>): void {
		this.props = { ...this.props, ...props };

		// Only re-render the project list - never destroy the input
		if (this.projectListContainer) {
			this.projectListContainer.empty();
			this.renderProjectList(this.projectListContainer);
		}
	}

	focusSearch(): void {
		setTimeout(() => this.searchInput?.focus(), 50);
	}
}
