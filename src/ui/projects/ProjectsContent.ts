import {
	Platform,
	setIcon,
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
import { createProjectRow, ProjectRow } from "./components/ProjectRow";
import { initDragManager, type DragManagerResult } from "./helpers/drag-manager";
import type { ProjectContextAction } from "./helpers/project-context-menu";
import type { NoteDropAction } from "./helpers/note-drop-menu";
import { showNoteContextMenu, type NoteContextAction } from "./helpers/note-context-menu";

const VIRTUAL_SCROLL_THRESHOLD = 30;

interface ProjectElementRefs {
	container: HTMLElement;
	row: ProjectRow;
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
	onToggleExpand: (projectId: string) => void;
	onCreateFromNote: () => void;
	onRefresh: () => void;
	// Context menu action handler (replaces individual onStartReview, onCustomStudy, etc.)
	onContextAction: (action: ProjectContextAction, project: ProjectInfo) => void;
	// Drag & drop handlers
	onReorderProjects: (newOrder: string[]) => void;
	onNoteDrop: (
		notePath: string,
		noteName: string,
		sourceProjectName: string | null,
		targetProjectName: string,
		action: NoteDropAction
	) => void;
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
	// Note action handlers
	onStartReviewNote: (notePath: string) => void;
	onNoteAction: (action: NoteContextAction, notePath: string, projectName: string) => void;
	// Show/hide done notes
	showDoneNotes: boolean;
	onToggleShowDoneNotes: () => void;
}

export class ProjectsContent extends BaseComponent {
	private props: ProjectsContentProps;
	private searchInput: HTMLInputElement | null = null;
	private projectListContainer: HTMLElement | null = null;

	private projectElements: Map<string, ProjectElementRefs> = new Map();
	private noteListItems: Map<string, NoteListItem> = new Map();
	private unassignedRefs: { container: HTMLElement; notesContainer: HTMLElement | null } | null = null;
	private virtualLists: Map<string, VirtualNotesList> = new Map();
	private sectionHeader: SectionHeader | null = null;
	private dragManager: DragManagerResult | null = null;

	constructor(container: HTMLElement, props: ProjectsContentProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.clearReferences();

		this.element = this.container.createDiv({
			cls: "true-recall-projects-content ep:flex ep:flex-col ep:h-full ep:gap-2",
		});

		if (!Platform.isMobile) {
			const headerWrapper = this.element.createDiv();
			const actions = this.getSectionHeaderActions();
			this.sectionHeader = createSectionHeader(headerWrapper, {
				title: "Projects",
				actions,
			});

			this.renderSearchInput();
		}

		this.projectListContainer = this.element.createDiv({
			cls: "ep:flex-1 ep:overflow-y-auto ep:min-h-0",
		});

		this.renderProjectList(this.projectListContainer);
	}

	private clearReferences(): void {
		this.dragManager?.destroyAll();
		this.dragManager = null;

		for (const refs of this.projectElements.values()) {
			refs.row.destroy();
		}
		this.projectElements.clear();
		this.noteListItems.clear();
		this.unassignedRefs = null;
		this.allProjectsMapCache = null;

		for (const vl of this.virtualLists.values()) {
			vl.destroy();
		}
		this.virtualLists.clear();
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

		// Initialize drag & drop before rendering so note sortables can register
		this.dragManager = initDragManager(listEl, {
			onReorderProjects: (order) => this.props.onReorderProjects(order),
			onNoteDrop: (notePath, noteName, source, target, action) =>
				this.props.onNoteDrop(notePath, noteName, source, target, action),
		});

		for (const project of projectsWithCards) {
			this.renderProjectTreeNode(listEl, project, 0);
		}

		if (hasUnassigned) {
			this.renderUnassignedSection(listEl);
		}

		if (emptyProjects.length > 0 && (projectsWithCards.length > 0 || hasUnassigned)) {
			listEl.createDiv({
				cls: "ep-no-drag ep:text-ui-small ep:font-semibold ep:text-obs-faint ep:py-3 ep:px-3",
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
		const isExpanded = this.props.expandedProjectIds.has(project.id);

		// Wrapper for the project row + its expanded content
		const wrapper = container.createDiv({
			cls: "ep:flex ep:flex-col ep:border-b ep:border-obs-modifier-border",
			attr: { "data-project-id": project.id },
		});

		const row = createProjectRow(wrapper, {
			project,
			depth,
			isExpanded,
			app: this.props.app,
			component: this.props.component,
			onToggleExpand: (id) => this.props.onToggleExpand(id),
			onContextAction: (action, proj) => this.props.onContextAction(action, proj),
		});

		const refs: ProjectElementRefs = {
			container: wrapper,
			row,
			notesContainer: null,
		};

		if (isExpanded && project.notes.length > 0) {
			refs.notesContainer = this.renderNotesList(wrapper, project.notes, project.name, project.id);
		}

		this.projectElements.set(project.id, refs);

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

	private renderNotesList(
		container: HTMLElement,
		notes: ProjectNoteInfo[],
		projectName: string,
		listId?: string
	): HTMLElement {
		const { selectedNotePaths, showDoneNotes } = this.props;
		const notesContainer = container.createDiv({
			cls: "ep:border-t ep:border-obs-border",
			attr: { "data-project-name": projectName },
		});

		let filteredNotes = notes;
		if (!showDoneNotes) {
			filteredNotes = notes.filter((n) => n.cardCount > 0);
		}

		if (filteredNotes.length === 0 && notes.length > 0 && !showDoneNotes) {
			notesContainer.createDiv({
				cls: "ep:py-4 ep:px-3 ep:text-center ep:text-obs-faint ep:text-ui-small",
				text: "All notes are done",
			});
			return notesContainer;
		}

		const sortedNotes = [...filteredNotes].sort((a, b) => {
			const aHasCards = a.newCount + a.learningCount + a.dueCount > 0;
			const bHasCards = b.newCount + b.learningCount + b.dueCount > 0;
			if (aHasCards && !bHasCards) return -1;
			if (!aHasCards && bHasCards) return 1;
			return a.name.localeCompare(b.name);
		});

		if (sortedNotes.length > VIRTUAL_SCROLL_THRESHOLD) {
			const virtualList = new VirtualNotesList(notesContainer, {
				notes: sortedNotes,
				selectedNotePaths,
				app: this.props.app,
				component: this.props.component,
				onCheckboxChange: (notePath) => {
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

			if (listId) {
				this.virtualLists.set(listId, virtualList);
			}
		} else {
			for (const note of sortedNotes) {
				const isSelected = selectedNotePaths.has(note.path);
				const noteWrapper = notesContainer.createDiv({
					attr: {
						"data-note-path": note.path,
						"data-note-name": note.name,
					},
				});

				const noteItem = createNoteListItem(noteWrapper, {
					noteName: note.name,
					notePath: note.path,
					newCount: note.newCount,
					learningCount: note.learningCount,
					dueCount: note.dueCount,
					isSelected,
					app: this.props.app,
					component: this.props.component,
					indent: true,
					showDragHandle: true,
					showActions: true,
					onPlay: () => this.props.onStartReviewNote(note.path),
					onMoreMenu: (position) => {
						showNoteContextMenu(position, {
							noteName: note.name,
							onAction: (action) =>
								this.props.onNoteAction(action, note.path, projectName),
						});
					},
					onCheckboxChange: () => {
						if (this.props.selectionMode !== "selecting") {
							this.props.onEnterSelectionMode(note.path);
						} else {
							this.props.onToggleNoteSelection(note.path);
						}
					},
				});

				this.noteListItems.set(note.path, noteItem);
			}
		}

		// Initialize sortable for note DnD if drag manager is ready
		if (this.dragManager && listId) {
			this.dragManager.initNotesListSortable(notesContainer, projectName);
		}

		return notesContainer;
	}

	private renderUnassignedSection(container: HTMLElement): void {
		const { unassignedNotes, isUnassignedExpanded } = this.props;

		let totalDue = 0;
		for (const note of unassignedNotes) {
			totalDue += note.newCount + note.learningCount + note.dueCount;
		}

		const item = container.createDiv({
			cls: "ep-no-drag ep:flex ep:flex-col ep:border-b ep:border-obs-modifier-border",
		});

		const mainRow = item.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2 ep:py-2.5 ep:px-3 ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});

		this.events.addEventListener(mainRow, "click", (e) => {
			if ((e.target as HTMLElement).closest("button")) return;
			this.props.onToggleUnassignedExpanded();
		});

		// Chevron
		const chevron = mainRow.createDiv({
			cls: `ep-chevron ep:flex ep:items-center ep:justify-center ep:w-4 ep:h-4 ep:shrink-0 ep:text-obs-muted [&_svg]:ep:w-3 [&_svg]:ep:h-3${isUnassignedExpanded ? " ep-chevron-expanded" : ""}`,
		});
		setIcon(chevron, "chevron-right");

		// Name
		mainRow.createDiv({
			cls: "ep:flex-1 ep:min-w-0 ep:text-ui-small ep:font-medium ep:text-obs-muted ep:leading-snug",
			text: `Unassigned (${unassignedNotes.length})`,
		});

		// Due count
		if (totalDue > 0) {
			mainRow.createDiv({
				text: String(totalDue),
				cls: "ep:text-ui-smaller ep:font-semibold ep:text-obs-accent ep:shrink-0",
			});
		}

		// Review button for unassigned
		if (totalDue > 0) {
			const iconBtnCls =
				"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";

			const reviewBtn = mainRow.createEl("button", {
				cls: iconBtnCls,
				attr: { "aria-label": "Review unassigned" },
			});
			setIcon(reviewBtn, "play");
			this.events.addEventListener(reviewBtn, "click", (e) => {
				e.stopPropagation();
				this.props.onStartReviewUnassigned();
			});
		}

		this.unassignedRefs = {
			container: item,
			notesContainer: null,
		};

		if (isUnassignedExpanded && unassignedNotes.length > 0) {
			this.unassignedRefs.notesContainer = this.renderNotesList(
				item,
				unassignedNotes,
				"__unassigned__",
				"unassigned"
			);
		}
	}

	updateProps(props: Partial<ProjectsContentProps>): void {
		const prevProps = this.props;
		this.props = { ...this.props, ...props };

		if (prevProps.showDoneNotes !== this.props.showDoneNotes && this.sectionHeader) {
			this.sectionHeader.updateProps({ actions: this.getSectionHeaderActions() });
		}

		if (this.projectElements.size === 0) {
			this.fullRender();
			return;
		}

		const dataChanged =
			!projectsEqual(prevProps.projectsWithCards, this.props.projectsWithCards) ||
			!projectsEqual(prevProps.emptyProjects, this.props.emptyProjects) ||
			!notesEqual(prevProps.unassignedNotes, this.props.unassignedNotes) ||
			prevProps.isLoading !== this.props.isLoading ||
			prevProps.searchQuery !== this.props.searchQuery ||
			prevProps.showDoneNotes !== this.props.showDoneNotes;

		if (dataChanged) {
			this.fullRender();
			return;
		}

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
			this.fullRender();
			return;
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

	private applyUnassignedExpansionChange(): void {
		if (!this.unassignedRefs) return;

		if (this.props.isUnassignedExpanded) {
			if (this.props.unassignedNotes.length > 0) {
				this.unassignedRefs.notesContainer = this.renderNotesList(
					this.unassignedRefs.container,
					this.props.unassignedNotes,
					"__unassigned__",
					"unassigned"
				);
			}
		} else {
			if (this.unassignedRefs.notesContainer) {
				for (const note of this.props.unassignedNotes) {
					this.noteListItems.delete(note.path);
				}
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

		for (const vl of this.virtualLists.values()) {
			vl.updateSelection(this.props.selectedNotePaths);
		}
	}

	focusSearch(): void {
		setTimeout(() => this.searchInput?.focus(), 50);
	}

	destroy(): void {
		this.clearReferences();
		super.destroy();
	}
}
