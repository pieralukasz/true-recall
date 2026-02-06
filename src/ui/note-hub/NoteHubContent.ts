import { type App, setIcon } from "obsidian";
import { BaseComponent } from "../component.base";
import {
	createCardCountDisplay,
	createLoadingSpinner,
	createEmptyState,
	type CardCountDisplay,
	type LoadingSpinner,
	type EmptyState,
} from "../components";
import { NoteHubNoteRow, createNoteHubNoteRow } from "./NoteHubNoteRow";
import type { ProjectInfo, ProjectNoteInfo } from "../../types";
import type { SelectionMode } from "../../state/store";

export interface NoteHubContentProps {
	isLoading: boolean;
	projects: ProjectInfo[];
	unassignedNotes: ProjectNoteInfo[];
	expandedProjectIds: Set<string>;
	selectionMode: SelectionMode;
	selectedNotePaths: Set<string>;
	onToggleExpand: (projectId: string) => void;
	onToggleNoteSelection: (notePath: string) => void;
	onEnterSelectionMode: (notePath: string) => void;
	onOpenNote: (path: string) => void;
	onStartReview: (filter: { sourceNoteFilters?: string[]; projectFilters?: string[] }) => void;
	onStartReviewProject: (projectName: string) => void;
	onGenerateCards: (notePath: string) => void;
	onAddToProject: (notePath: string) => void;
	onRemoveFromProject: (notePath: string, projectName: string) => void;
	onAddNotesToProject: (projectName: string) => void;
	app: App;
}

type NoteHubContentUpdatableProps = Partial<
	Pick<
		NoteHubContentProps,
		| "isLoading"
		| "projects"
		| "unassignedNotes"
		| "expandedProjectIds"
		| "selectionMode"
		| "selectedNotePaths"
	>
>;

export class NoteHubContent extends BaseComponent {
	private props: NoteHubContentProps;
	private loadingSpinner: LoadingSpinner | null = null;
	private emptyState: EmptyState | null = null;
	private noteRows: Map<string, NoteHubNoteRow> = new Map();
	private cardCountDisplays: Map<string, CardCountDisplay> = new Map();
	private isUnassignedExpanded = false;

	constructor(container: HTMLElement, props: NoteHubContentProps) {
		super(container);
		this.props = props;
		this.isUnassignedExpanded = props.expandedProjectIds.has("__unassigned__");
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}
		this.clearChildComponents();

		this.element = this.container.createDiv({
			cls: "ep:flex ep:flex-col ep:flex-1 ep:overflow-y-auto ep:min-h-0",
		});

		if (this.props.isLoading) {
			this.loadingSpinner = createLoadingSpinner(this.element);
			return;
		}

		if (this.props.projects.length === 0 && this.props.unassignedNotes.length === 0) {
			this.emptyState = createEmptyState(this.element, {
				message: "No notes with flashcards yet",
			});
			return;
		}

		for (const project of this.props.projects) {
			this.renderProjectGroup(this.element, project);
		}

		if (this.props.unassignedNotes.length > 0) {
			this.renderUnassignedSection(this.element);
		}
	}

	private renderProjectGroup(parent: HTMLElement, project: ProjectInfo): void {
		const isExpanded = this.props.expandedProjectIds.has(project.id);

		const section = parent.createDiv({
			cls: "ep:flex ep:flex-col",
		});

		const header = section.createDiv({
			cls: "ep:flex ep:items-center ep:gap-3 ep:py-3 ep:px-4 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:transition-colors ep:border-b ep:border-obs-modifier-border",
		});

		this.events.addEventListener(header, "click", (e) => {
			if ((e.target as HTMLElement).closest("button")) return;
			this.props.onToggleExpand(project.id);
		});

		const chevron = header.createDiv({
			cls: "ep:shrink-0 ep:flex ep:items-center ep:text-obs-muted [&_svg]:ep:w-4 [&_svg]:ep:h-4",
		});
		setIcon(chevron, isExpanded ? "chevron-down" : "chevron-right");

		header.createDiv({
			text: project.name,
			cls: "ep:font-medium ep:text-obs-normal ep:text-ui-small",
		});

		const noteText = project.noteCount === 1 ? "1 note" : `${project.noteCount} notes`;
		header.createDiv({
			text: noteText,
			cls: "ep:text-obs-muted ep:text-ui-smaller",
		});

		if (project.cardCount > 0) {
			const countsContainer = header.createDiv({ cls: "ep:shrink-0" });
			const display = createCardCountDisplay(countsContainer, {
				newCount: project.newCount,
				learningCount: project.learningCount,
				dueCount: project.dueCount,
				totalCount: project.cardCount,
			});
			this.cardCountDisplays.set(project.id, display);
		}

		const actions = header.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1 ep:shrink-0 ep:ml-auto",
		});

		const iconBtnCls =
			"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";

		const reviewBtn = actions.createEl("button", {
			cls: iconBtnCls,
			attr: { "aria-label": "Review project" },
		});
		setIcon(reviewBtn, "play");
		this.events.addEventListener(reviewBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onStartReviewProject(project.name);
		});

		const addBtn = actions.createEl("button", {
			cls: iconBtnCls,
			attr: { "aria-label": "Add note to project" },
		});
		setIcon(addBtn, "plus");
		this.events.addEventListener(addBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onAddNotesToProject(project.name);
		});

		if (isExpanded && project.notes.length > 0) {
			this.renderNoteRows(section, project.notes, project.name);
		}
	}

	private renderUnassignedSection(parent: HTMLElement): void {
		const section = parent.createDiv({
			cls: "ep:flex ep:flex-col",
		});

		const header = section.createDiv({
			cls: "ep:flex ep:items-center ep:gap-3 ep:py-3 ep:px-4 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:transition-colors ep:border-b ep:border-obs-modifier-border",
		});

		this.events.addEventListener(header, "click", (e) => {
			if ((e.target as HTMLElement).closest("button")) return;
			this.isUnassignedExpanded = !this.isUnassignedExpanded;
			this.render();
		});

		const chevron = header.createDiv({
			cls: "ep:shrink-0 ep:flex ep:items-center ep:text-obs-muted [&_svg]:ep:w-4 [&_svg]:ep:h-4",
		});
		setIcon(chevron, this.isUnassignedExpanded ? "chevron-down" : "chevron-right");

		header.createDiv({
			text: "Unassigned Notes",
			cls: "ep:font-medium ep:text-obs-normal ep:text-ui-small",
		});

		const noteText =
			this.props.unassignedNotes.length === 1
				? "1 note"
				: `${this.props.unassignedNotes.length} notes`;
		header.createDiv({
			text: noteText,
			cls: "ep:text-obs-muted ep:text-ui-smaller",
		});

		let totalNew = 0;
		let totalLearning = 0;
		let totalDue = 0;
		let totalCards = 0;
		for (const note of this.props.unassignedNotes) {
			totalNew += note.newCount;
			totalLearning += note.learningCount;
			totalDue += note.dueCount;
			totalCards += note.cardCount;
		}

		if (totalCards > 0) {
			const countsContainer = header.createDiv({ cls: "ep:shrink-0" });
			const display = createCardCountDisplay(countsContainer, {
				newCount: totalNew,
				learningCount: totalLearning,
				dueCount: totalDue,
				totalCount: totalCards,
			});
			this.cardCountDisplays.set("__unassigned__", display);
		}

		if (this.isUnassignedExpanded && this.props.unassignedNotes.length > 0) {
			this.renderNoteRows(section, this.props.unassignedNotes, null);
		}
	}

	private renderNoteRows(
		parent: HTMLElement,
		notes: ProjectNoteInfo[],
		projectName: string | null
	): void {
		for (const note of notes) {
			const row = createNoteHubNoteRow(parent, {
				note,
				projectName,
				isSelected: this.props.selectedNotePaths.has(note.path),
				selectionMode: this.props.selectionMode,
				onToggleSelection: this.props.onToggleNoteSelection,
				onEnterSelectionMode: this.props.onEnterSelectionMode,
				onOpenNote: this.props.onOpenNote,
				onStartReview: this.props.onStartReview,
				onGenerateCards: this.props.onGenerateCards,
				onAddToProject: this.props.onAddToProject,
				onRemoveFromProject: this.props.onRemoveFromProject,
				app: this.props.app,
			});
			this.noteRows.set(note.path, row);
		}
	}

	updateProps(props: NoteHubContentUpdatableProps): void {
		const prevProps = this.props;
		this.props = { ...this.props, ...props };

		const dataChanged =
			prevProps.isLoading !== this.props.isLoading ||
			prevProps.projects !== this.props.projects ||
			prevProps.unassignedNotes !== this.props.unassignedNotes ||
			prevProps.selectionMode !== this.props.selectionMode;

		const expandedChanged = prevProps.expandedProjectIds !== this.props.expandedProjectIds;
		const selectionChanged = prevProps.selectedNotePaths !== this.props.selectedNotePaths;

		if (dataChanged || expandedChanged) {
			this.render();
			return;
		}

		if (selectionChanged) {
			for (const [path, row] of this.noteRows) {
				const isSelected = this.props.selectedNotePaths.has(path);
				row.updateSelected(isSelected);
			}
		}
	}

	private clearChildComponents(): void {
		for (const row of this.noteRows.values()) {
			row.destroy();
		}
		this.noteRows.clear();

		for (const display of this.cardCountDisplays.values()) {
			display.destroy();
		}
		this.cardCountDisplays.clear();

		this.loadingSpinner?.destroy();
		this.loadingSpinner = null;
		this.emptyState?.destroy();
		this.emptyState = null;
	}

	destroy(): void {
		this.clearChildComponents();
		super.destroy();
	}
}

export function createNoteHubContent(
	container: HTMLElement,
	props: NoteHubContentProps
): NoteHubContent {
	const content = new NoteHubContent(container, props);
	content.render();
	return content;
}
