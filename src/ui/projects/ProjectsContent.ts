/**
 * Projects Content Component
 * Contains search input and project list (flat list style like SessionContent)
 */
import {
	setIcon,
	MarkdownRenderer,
	Platform,
	Menu,
	type App,
	type Component,
} from "obsidian";
import { BaseComponent } from "../component.base";
import { createCardCountDisplay, createSectionHeader, createNoteListItem } from "../components";
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
	// Selection props
	selectionMode: "normal" | "selecting";
	selectedNotePaths: Set<string>;
	onEnterSelectionMode: (notePath: string) => void;
	onExitSelectionMode: () => void;
	onToggleNoteSelection: (notePath: string) => void;
	// Unassigned notes props
	unassignedNotes: ProjectNoteInfo[];
	isUnassignedExpanded: boolean;
	onToggleUnassignedExpanded: () => void;
	onStartReviewUnassigned: () => void;
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
			cls: "true-recall-projects-content ep:flex ep:flex-col ep:h-full ep:gap-2",
		});

		// Section header with buttons (desktop only - on mobile actions are in "..." menu)
		if (!Platform.isMobile) {
			createSectionHeader(this.element, {
				title: "Projects",
				actions: [
					{ icon: "refresh-cw", ariaLabel: "Refresh", onClick: () => this.props.onRefresh() },
					{ icon: "plus", ariaLabel: "New project", onClick: () => this.props.onCreateFromNote() },
				],
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
			cls: "true-recall-project-list",
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

		const { projectsWithCards, emptyProjects, unassignedNotes } = this.props;
		const hasProjects =
			projectsWithCards.length > 0 || emptyProjects.length > 0;
		const hasUnassigned = unassignedNotes.length > 0;

		if (!hasProjects && !hasUnassigned && !this.props.searchQuery) {
			listEl.createDiv({
				text: "No projects yet. Create one to get started!",
				cls: emptyStateCls,
			});
			return;
		}

		if (!hasProjects && !hasUnassigned && this.props.searchQuery) {
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

		// Render unassigned notes section (between projects with cards and empty projects)
		if (hasUnassigned) {
			this.renderUnassignedSection(listEl);
		}

		// Render empty projects (with separator if both exist)
		if (emptyProjects.length > 0 && (projectsWithCards.length > 0 || hasUnassigned)) {
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

		// Anki-style card counts (New · Learning · Due) with total
		if (hasCards) {
			createCardCountDisplay(statsEl, {
				newCount: project.newCount,
				learningCount: project.learningCount,
				dueCount: project.dueCount,
				totalCount: project.cardCount,
				variant: "full",
				size: "smaller",
				bold: true,
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
		const { selectionMode, selectedNotePaths } = this.props;
		const notesContainer = container.createDiv({
			cls: "ep:border-t ep:border-obs-modifier-border",
		});

		// Sort: notes with cards to review first, then completed notes
		const sortedNotes = [...notes].sort((a, b) => {
			const aHasCards = a.newCount + a.learningCount + a.dueCount > 0;
			const bHasCards = b.newCount + b.learningCount + b.dueCount > 0;
			if (aHasCards && !bHasCards) return -1;
			if (!aHasCards && bHasCards) return 1;
			return a.name.localeCompare(b.name);
		});

		for (const note of sortedNotes) {
			const isSelected = selectedNotePaths.has(note.path);

			createNoteListItem(notesContainer, {
				noteName: note.name,
				notePath: note.path,
				newCount: note.newCount,
				learningCount: note.learningCount,
				dueCount: note.dueCount,
				isSelected,
				app: this.props.app,
				component: this.props.component,
				indent: true,
				onCheckboxChange: () => {
					if (selectionMode !== "selecting") {
						this.props.onEnterSelectionMode(note.path);
					} else {
						this.props.onToggleNoteSelection(note.path);
					}
				},
			});
		}
	}

	/**
	 * Show context menu for note with "Select" option
	 */
	private showNoteContextMenu(e: MouseEvent, note: ProjectNoteInfo): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle("Select")
				.setIcon("check-square")
				.onClick(() => this.props.onEnterSelectionMode(note.path));
		});

		menu.showAtMouseEvent(e);
	}

	/**
	 * Render the unassigned notes section
	 */
	private renderUnassignedSection(container: HTMLElement): void {
		const { unassignedNotes, isUnassignedExpanded } = this.props;

		// Calculate totals
		let totalCards = 0;
		let totalNew = 0;
		let totalLearning = 0;
		let totalDue = 0;

		for (const note of unassignedNotes) {
			totalCards += note.cardCount;
			totalNew += note.newCount;
			totalLearning += note.learningCount;
			totalDue += note.dueCount;
		}

		const hasCards = totalCards > 0;

		// Unassigned section container
		const item = container.createDiv({
			cls: "ep:flex ep:flex-col ep:border-b ep:border-obs-modifier-border",
		});

		// Main row (clickable for expansion)
		const mainRow = item.createDiv({
			cls: "ep:flex ep:items-start ep:gap-3 ep:py-2.5 ep:px-3 ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});

		// Click handler for expand/collapse
		this.events.addEventListener(mainRow, "click", (e) => {
			// Don't trigger if clicked on action buttons
			if ((e.target as HTMLElement).closest("button")) return;
			this.props.onToggleUnassignedExpanded();
		});

		// Content container
		const content = mainRow.createDiv({
			cls: "ep:flex-1 ep:min-w-0",
		});

		// Section name
		content.createDiv({
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal ep:leading-snug",
			text: "Unassigned",
		});

		// Stats line with Anki-style colored counts
		const statsEl = content.createDiv({
			cls: "ep:text-ui-smaller ep:mt-0.5 ep:flex ep:items-center ep:gap-2",
		});

		// Note count (muted)
		const noteText =
			unassignedNotes.length === 1 ? "1 note" : `${unassignedNotes.length} notes`;
		statsEl.createSpan({
			text: noteText,
			cls: hasCards ? "ep:text-obs-muted" : "ep:text-obs-faint",
		});

		// Anki-style card counts (New · Learning · Due) with total
		if (hasCards) {
			createCardCountDisplay(statsEl, {
				newCount: totalNew,
				learningCount: totalLearning,
				dueCount: totalDue,
				totalCount: totalCards,
				variant: "full",
				size: "smaller",
				bold: true,
			});
		}

		// Actions container (right side)
		const actions = mainRow.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1 ep:shrink-0",
		});

		const iconBtnCls =
			"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";

		// Review button (only if has cards)
		if (hasCards) {
			const reviewBtn = actions.createEl("button", {
				cls: iconBtnCls,
				attr: { "aria-label": "Start review" },
			});
			setIcon(reviewBtn, "play");
			this.events.addEventListener(reviewBtn, "click", (e) => {
				e.stopPropagation();
				this.props.onStartReviewUnassigned();
			});
		}

		// Expanded content (notes list)
		if (isUnassignedExpanded && unassignedNotes.length > 0) {
			this.renderNotesList(item, unassignedNotes);
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
