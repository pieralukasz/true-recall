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
import {
	createSectionHeader,
	createNoteListItem,
	NoteListItem,
	SectionHeader,
	type SectionHeaderAction,
} from "../components";
import type { ProjectInfo, ProjectNoteInfo } from "../../types";
import type { ProjectGraph } from "../../utils/project-hierarchy";
import {
	setsEqual,
	difference,
	projectsEqual,
	notesEqual,
} from "./helpers/set-utils";
import { VirtualNotesList } from "./components/VirtualNotesList";

const VIRTUAL_SCROLL_THRESHOLD = 30; // Use virtual scrolling when more than 30 notes

interface ProjectElementRefs {
	container: HTMLElement;
	notesContainer: HTMLElement | null;
}

export interface ProjectsContentProps {
	isLoading: boolean;
	projectsWithCards: ProjectInfo[];
	emptyProjects: ProjectInfo[];
	allProjects: ProjectInfo[];
	projectGraph: ProjectGraph | null;
	searchQuery: string;
	expandedProjectIds: Set<string>;
	app: App;
	component: Component;
	onSearchChange: (query: string) => void;
	onStartReview: (projectName: string) => void;
	onCustomStudy: (projectName: string) => void;
	onDelete: (projectId: string) => void;
	onAddNotes: (projectId: string, projectName: string) => void;
	onCreateFromNote: () => void;
	onCreateSubProject: (projectName: string) => void;
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
	// Show/hide done notes
	showDoneNotes: boolean;
	onToggleShowDoneNotes: () => void;
}

/**
 * Content component for projects view
 */
export class ProjectsContent extends BaseComponent {
	private props: ProjectsContentProps;
	private searchInput: HTMLInputElement | null = null;
	private projectListContainer: HTMLElement | null = null;

	// References for granular updates
	private projectElements: Map<string, ProjectElementRefs> = new Map();
	private noteListItems: Map<string, NoteListItem> = new Map();
	private unassignedRefs: ProjectElementRefs | null = null;
	private virtualLists: Map<string, VirtualNotesList> = new Map();
	private sectionHeader: SectionHeader | null = null;

	constructor(container: HTMLElement, props: ProjectsContentProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		// Clear references on full render
		this.clearReferences();

		this.element = this.container.createDiv({
			cls: "true-recall-projects-content ep:flex ep:flex-col ep:h-full ep:gap-2",
		});

		// Section header with buttons (desktop only - on mobile actions are in "..." menu)
		if (!Platform.isMobile) {
			// Wrapper div maintains position when SectionHeader re-renders
			const headerWrapper = this.element.createDiv();
			const actions = this.getSectionHeaderActions();
			this.sectionHeader = createSectionHeader(headerWrapper, {
				title: "Projects",
				actions,
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

	private clearReferences(): void {
		this.projectElements.clear();
		this.noteListItems.clear();
		this.unassignedRefs = null;
		this.allProjectsMapCache = null;

		// Clean up virtual lists
		for (const vl of this.virtualLists.values()) {
			vl.destroy();
		}
		this.virtualLists.clear();

		// Note: SectionHeader is NOT cleared here - it's independent of project data
		// and only needs updating when showDoneNotes changes (handled in updateProps)
	}

	private getSectionHeaderActions(): SectionHeaderAction[] {
		return [
			{
				icon: this.props.showDoneNotes ? "eye" : "eye-off",
				ariaLabel: this.props.showDoneNotes
					? "Hide completed notes"
					: "Show completed notes",
				onClick: () => this.props.onToggleShowDoneNotes(),
			},
			{
				icon: "refresh-cw",
				ariaLabel: "Refresh",
				onClick: () => this.props.onRefresh(),
			},
			{
				icon: "plus",
				ariaLabel: "New project",
				onClick: () => this.props.onCreateFromNote(),
			},
		];
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

		// Render root projects with cards (and their children recursively)
		for (const project of projectsWithCards) {
			this.renderProjectTreeNode(listEl, project, 0);
		}

		// Render unassigned notes section (between projects with cards and empty projects)
		if (hasUnassigned) {
			this.renderUnassignedSection(listEl);
		}

		// Render empty root projects (with separator if both exist)
		if (emptyProjects.length > 0 && (projectsWithCards.length > 0 || hasUnassigned)) {
			listEl.createDiv({
				cls: "ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:py-3",
				text: "Empty projects",
			});
		}

		for (const project of emptyProjects) {
			this.renderProjectTreeNode(listEl, project, 0);
		}
	}

	private renderProjectTreeNode(
		container: HTMLElement,
		project: ProjectInfo,
		depth: number
	): void {
		const isEmpty = project.cardCount === 0;
		const isExpanded = this.props.expandedProjectIds.has(project.id);

		this.renderProjectItem(container, project, isEmpty, depth);

		if (!isExpanded) return;

		// Render child sub-projects
		const childNames = project.childProjectNames ?? [];
		if (childNames.length > 0) {
			const allProjectsMap = this.getAllProjectsMap();
			for (const childName of childNames) {
				const childProject = allProjectsMap.get(childName);
				if (childProject) {
					this.renderProjectTreeNode(container, childProject, depth + 1);
				}
			}
		}
	}

	private allProjectsMapCache: Map<string, ProjectInfo> | null = null;

	private getAllProjectsMap(): Map<string, ProjectInfo> {
		if (!this.allProjectsMapCache) {
			this.allProjectsMapCache = new Map(
				this.props.allProjects.map((p) => [p.name, p])
			);
		}
		return this.allProjectsMapCache;
	}

	private renderProjectItem(
		container: HTMLElement,
		project: ProjectInfo,
		isEmpty: boolean,
		depth: number = 0
	): void {
		const hasCards = project.cardCount > 0;
		const isExpanded = this.props.expandedProjectIds.has(project.id);
		const hasChildren = (project.childProjectNames?.length ?? 0) > 0;

		// Project item container
		const item = container.createDiv({
			cls: `ep:flex ep:flex-col ep:border-b ep:border-obs-modifier-border${
				isEmpty ? " ep:opacity-60" : ""
			}`,
		});

		// Main container - clickable for expansion
		const mainContainer = item.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-1.5 ep:py-2.5 ep:px-3 ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});
		if (depth > 0) {
			mainContainer.style.paddingLeft = `${12 + depth * 20}px`;
		}

		// Click handler for expand/collapse
		this.events.addEventListener(mainContainer, "click", (e) => {
			// Don't trigger if clicked on action buttons
			if ((e.target as HTMLElement).closest("button")) return;
			this.props.onToggleExpand(project.id);
		});

		// Top row: project name + action buttons
		const topRow = mainContainer.createDiv({
			cls: "ep:flex ep:items-start ep:gap-2",
		});

		// Project name as clickable wiki link
		const nameEl = topRow.createDiv({
			cls: "ep:flex-1 ep:min-w-0 ep:text-ui-small ep:font-medium ep:text-obs-normal ep:leading-snug ep:line-clamp-2 [&_p]:ep:m-0 [&_p]:ep:inline [&_a.internal-link]:ep:text-obs-normal [&_a.internal-link]:ep:no-underline [&_a.internal-link:hover]:ep:text-obs-link [&_a.internal-link:hover]:ep:underline",
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

		// Actions container (right side of top row)
		const actions = topRow.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1 ep:shrink-0",
		});

		// Bottom row: note count + card counts (aligned)
		const bottomRow = mainContainer.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between",
		});

		const noteText =
			project.noteCount === 1 ? "1 note" : `${project.noteCount} notes`;
		bottomRow.createSpan({
			text: noteText,
			cls: `ep:text-ui-smaller ${hasCards ? "ep:text-obs-muted" : "ep:text-obs-faint"}`,
		});

		if (hasCards) {
			const countsEl = bottomRow.createDiv({
				cls: "ep:flex ep:items-center ep:gap-1",
			});
			const badgeCls = "ep:flex ep:items-center ep:justify-center ep:min-w-5 ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold";
			countsEl.createDiv({
				text: String(project.newCount),
				cls: `${badgeCls} ep-bg-obs-green-20 ep:text-obs-green`,
			});
			countsEl.createDiv({
				text: String(project.learningCount),
				cls: `${badgeCls} ep-bg-obs-orange-20 ep:text-obs-orange`,
			});
			countsEl.createDiv({
				text: String(project.dueCount),
				cls: `${badgeCls} ep-bg-obs-blue-20 ep:text-obs-blue`,
			});
		}

		const iconBtnCls =
			"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";

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

		// Create sub-project button
		const subProjectBtn = actions.createEl("button", {
			cls: iconBtnCls,
			attr: { "aria-label": "Create sub-project" },
		});
		setIcon(subProjectBtn, "folder-plus");
		this.events.addEventListener(subProjectBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onCreateSubProject(project.name);
		});

		// Review & custom study buttons (only if has cards)
		if (hasCards) {
			const customStudyBtn = actions.createEl("button", {
				cls: iconBtnCls,
				attr: { "aria-label": "Custom study" },
			});
			setIcon(customStudyBtn, "sliders-horizontal");
			this.events.addEventListener(customStudyBtn, "click", (e) => {
				e.stopPropagation();
				this.props.onCustomStudy(project.name);
			});

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

		// Store project element reference
		const refs: ProjectElementRefs = {
			container: item,
			notesContainer: null,
		};

		// Expanded content (notes list)
		if (isExpanded && project.notes.length > 0) {
			refs.notesContainer = this.renderNotesList(item, project.notes, project.id);
		}

		this.projectElements.set(project.id, refs);
	}

	private renderNotesList(
		container: HTMLElement,
		notes: ProjectNoteInfo[],
		listId?: string
	): HTMLElement {
		const { selectedNotePaths, showDoneNotes } = this.props;
		const notesContainer = container.createDiv({
			cls: "ep:border-t ep:border-obs-border",
		});

		// Filter: hide notes without any flashcards unless showDoneNotes is true
		// Notes WITH flashcards are always shown (even if all cards are "done")
		let filteredNotes = notes;
		if (!showDoneNotes) {
			filteredNotes = notes.filter((n) => n.cardCount > 0);
		}

		// Show message if all notes are done (filtered out)
		if (filteredNotes.length === 0 && notes.length > 0 && !showDoneNotes) {
			notesContainer.createDiv({
				cls: "ep:py-4 ep:px-3 ep:text-center ep:text-obs-faint ep:text-ui-small",
				text: "All notes are done",
			});
			return notesContainer;
		}

		// Sort: notes with cards to review first, then completed notes
		const sortedNotes = [...filteredNotes].sort((a, b) => {
			const aHasCards = a.newCount + a.learningCount + a.dueCount > 0;
			const bHasCards = b.newCount + b.learningCount + b.dueCount > 0;
			if (aHasCards && !bHasCards) return -1;
			if (!aHasCards && bHasCards) return 1;
			return a.name.localeCompare(b.name);
		});

		// Use virtual scrolling for large lists
		if (sortedNotes.length > VIRTUAL_SCROLL_THRESHOLD) {
			const virtualList = new VirtualNotesList(notesContainer, {
				notes: sortedNotes,
				selectedNotePaths,
				app: this.props.app,
				component: this.props.component,
				onCheckboxChange: (notePath, isSelecting) => {
					if (this.props.selectionMode !== "selecting") {
						this.props.onEnterSelectionMode(notePath);
					} else {
						this.props.onToggleNoteSelection(notePath);
					}
				},
				onNoteListItemCreated: (notePath, item) => {
					this.noteListItems.set(notePath, item);
				},
			});
			virtualList.render();

			// Track virtual list for cleanup and selection updates
			if (listId) {
				this.virtualLists.set(listId, virtualList);
			}
		} else {
			// Simple rendering for small lists
			for (const note of sortedNotes) {
				const isSelected = selectedNotePaths.has(note.path);

				const noteItem = createNoteListItem(notesContainer, {
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
						if (this.props.selectionMode !== "selecting") {
							this.props.onEnterSelectionMode(note.path);
						} else {
							this.props.onToggleNoteSelection(note.path);
						}
					},
				});

				// Store reference for granular selection updates
				this.noteListItems.set(note.path, noteItem);
			}
		}

		return notesContainer;
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

		if (hasCards) {
			const badgeCls = "ep:flex ep:items-center ep:justify-center ep:min-w-5 ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold";
			const countsEl = statsEl.createDiv({
				cls: "ep:flex ep:items-center ep:gap-1",
			});
			countsEl.createDiv({
				text: String(totalNew),
				cls: `${badgeCls} ep-bg-obs-green-20 ep:text-obs-green`,
			});
			countsEl.createDiv({
				text: String(totalLearning),
				cls: `${badgeCls} ep-bg-obs-orange-20 ep:text-obs-orange`,
			});
			countsEl.createDiv({
				text: String(totalDue),
				cls: `${badgeCls} ep-bg-obs-blue-20 ep:text-obs-blue`,
			});
		}

		// Actions container (right side)
		const actions = mainRow.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1 ep:shrink-0",
		});

		const iconBtnCls =
			"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";

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

		// Store unassigned section reference
		this.unassignedRefs = {
			container: item,
			notesContainer: null,
		};

		// Expanded content (notes list)
		if (isUnassignedExpanded && unassignedNotes.length > 0) {
			this.unassignedRefs.notesContainer = this.renderNotesList(
				item,
				unassignedNotes,
				"unassigned"
			);
		}
	}

	updateProps(props: Partial<ProjectsContentProps>): void {
		const prevProps = this.props;
		this.props = { ...this.props, ...props };

		// Update section header icon when showDoneNotes changes
		if (prevProps.showDoneNotes !== this.props.showDoneNotes && this.sectionHeader) {
			this.sectionHeader.updateProps({ actions: this.getSectionHeaderActions() });
		}

		// First render - no references yet
		if (this.projectElements.size === 0) {
			this.fullRender();
			return;
		}

		// Detect what changed
		const dataChanged =
			!projectsEqual(prevProps.projectsWithCards, this.props.projectsWithCards) ||
			!projectsEqual(prevProps.emptyProjects, this.props.emptyProjects) ||
			!notesEqual(prevProps.unassignedNotes, this.props.unassignedNotes) ||
			prevProps.isLoading !== this.props.isLoading ||
			prevProps.searchQuery !== this.props.searchQuery ||
			prevProps.showDoneNotes !== this.props.showDoneNotes;

		// Data changed (counts, loading, search) → full re-render needed
		if (dataChanged) {
			this.fullRender();
			return;
		}

		// Granular updates for UI-only state changes
		const expandedChanged = !setsEqual(
			prevProps.expandedProjectIds,
			this.props.expandedProjectIds
		);
		const selectionChanged = !setsEqual(
			prevProps.selectedNotePaths,
			this.props.selectedNotePaths
		);
		const unassignedExpandedChanged =
			prevProps.isUnassignedExpanded !== this.props.isUnassignedExpanded;

		if (expandedChanged) {
			const toExpand = difference(
				this.props.expandedProjectIds,
				prevProps.expandedProjectIds
			);
			const toCollapse = difference(
				prevProps.expandedProjectIds,
				this.props.expandedProjectIds
			);
			this.applyExpansionChanges(toExpand, toCollapse);
		}

		if (unassignedExpandedChanged) {
			this.applyUnassignedExpansionChange();
		}

		if (selectionChanged) {
			const added = difference(
				this.props.selectedNotePaths,
				prevProps.selectedNotePaths
			);
			const removed = difference(
				prevProps.selectedNotePaths,
				this.props.selectedNotePaths
			);
			this.applySelectionChanges(added, removed);
		}
	}

	private fullRender(): void {
		this.clearReferences();
		if (this.projectListContainer) {
			this.projectListContainer.empty();
			this.renderProjectList(this.projectListContainer);
		}
	}

	private applyExpansionChanges(
		_toExpand: Set<string>,
		_toCollapse: Set<string>
	): void {
		// Tree structure makes granular updates complex — full re-render is simpler
		this.fullRender();
	}

	private applyUnassignedExpansionChange(): void {
		if (!this.unassignedRefs) return;

		if (this.props.isUnassignedExpanded) {
			// Expand
			if (this.props.unassignedNotes.length > 0) {
				this.unassignedRefs.notesContainer = this.renderNotesList(
					this.unassignedRefs.container,
					this.props.unassignedNotes,
					"unassigned"
				);
			}
		} else {
			// Collapse
			if (this.unassignedRefs.notesContainer) {
				for (const note of this.props.unassignedNotes) {
					this.noteListItems.delete(note.path);
				}
				// Clean up virtual list if exists
				const vl = this.virtualLists.get("unassigned");
				if (vl) {
					vl.destroy();
					this.virtualLists.delete("unassigned");
				}
				this.unassignedRefs.notesContainer.remove();
				this.unassignedRefs.notesContainer = null;
			}
		}
	}

	private applySelectionChanges(added: Set<string>, removed: Set<string>): void {
		// Update individual note items
		for (const path of added) {
			const noteItem = this.noteListItems.get(path);
			if (noteItem) {
				noteItem.updateSelected(true);
			}
		}

		for (const path of removed) {
			const noteItem = this.noteListItems.get(path);
			if (noteItem) {
				noteItem.updateSelected(false);
			}
		}

		// Update virtual lists with new selection
		for (const vl of this.virtualLists.values()) {
			vl.updateSelection(this.props.selectedNotePaths);
		}
	}

	private findProject(id: string): ProjectInfo | undefined {
		return (
			this.props.projectsWithCards.find((p) => p.id === id) ||
			this.props.emptyProjects.find((p) => p.id === id)
		);
	}

	focusSearch(): void {
		setTimeout(() => this.searchInput?.focus(), 50);
	}
}
