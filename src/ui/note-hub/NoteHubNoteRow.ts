import { type App, Menu, setIcon } from "obsidian";
import { BaseComponent } from "../component.base";
import { createCardCountDisplay, type CardCountDisplay } from "../components";
import type { ProjectNoteInfo } from "../../types";

export interface NoteHubNoteRowProps {
	note: ProjectNoteInfo;
	projectName: string | null;
	isSelected: boolean;
	selectionMode: "normal" | "selecting";
	onToggleSelection: (path: string) => void;
	onEnterSelectionMode: (path: string) => void;
	onOpenNote: (path: string) => void;
	onStartReview: (filter: { sourceNoteFilters: string[] }) => void;
	onCustomStudy: (filter: { sourceNoteFilters: string[] }) => void;
	onGenerateCards: (path: string) => void;
	onAddToProject: (path: string) => void;
	onRemoveFromProject: (path: string, projectName: string) => void;
	app: App;
}

export class NoteHubNoteRow extends BaseComponent {
	private props: NoteHubNoteRowProps;
	private checkboxEl: HTMLInputElement | null = null;
	private cardCountDisplay: CardCountDisplay | null = null;

	constructor(container: HTMLElement, props: NoteHubNoteRowProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}
		this.checkboxEl = null;
		this.cardCountDisplay = null;

		const { note, projectName, isSelected, selectionMode } = this.props;

		this.element = this.container.createDiv({
			cls: `ep:group ep:flex ep:items-center ep:gap-3 ep:py-2.5 ep:px-4 ep:pl-8 ep:border-b ep:border-obs-modifier-border ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0${isSelected ? " ep:bg-obs-interactive/10" : ""}`,
		});

		const checkboxContainer = this.element.createDiv({
			cls: `ep:shrink-0 ep:flex ep:items-center${selectionMode === "selecting" ? "" : " ep:opacity-0 ep:group-hover:opacity-100"}`,
		});
		this.checkboxEl = checkboxContainer.createEl("input", {
			type: "checkbox",
			cls: "ep:w-4 ep:h-4 ep:cursor-pointer",
		});
		this.checkboxEl.checked = isSelected;

		this.events.addEventListener(this.checkboxEl, "change", () => {
			if (this.props.selectionMode !== "selecting") {
				this.props.onEnterSelectionMode(note.path);
			} else {
				this.props.onToggleSelection(note.path);
			}
		});
		this.events.addEventListener(this.checkboxEl, "click", (e) => {
			e.stopPropagation();
		});

		const nameEl = this.element.createDiv({
			text: note.name,
			cls: "ep:flex-1 ep:min-w-0 ep:truncate ep:text-ui-small ep:font-medium ep:text-obs-normal ep:cursor-pointer ep:hover:text-obs-link ep:hover:underline",
		});

		this.events.addEventListener(nameEl, "click", (e) => {
			e.stopPropagation();
			this.props.onOpenNote(note.path);
		});

		const countsContainer = this.element.createDiv({
			cls: "ep:shrink-0",
		});
		this.cardCountDisplay = createCardCountDisplay(countsContainer, {
			newCount: note.newCount,
			learningCount: note.learningCount,
			dueCount: note.dueCount,
		});

		if (selectionMode !== "selecting") {
			this.renderActionButtons(this.element, note, projectName);
		}
	}

	private renderActionButtons(
		parent: HTMLElement,
		note: ProjectNoteInfo,
		projectName: string | null
	): void {
		const actionsContainer = parent.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1 ep:shrink-0 ep:opacity-0 ep:group-hover:opacity-100 ep:transition-opacity",
		});

		const iconBtnCls =
			"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";

		const reviewBtn = actionsContainer.createEl("button", {
			cls: iconBtnCls,
			attr: { "aria-label": "Review note" },
		});
		setIcon(reviewBtn, "play");
		this.events.addEventListener(reviewBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onStartReview({ sourceNoteFilters: [note.name] });
		});

		const generateBtn = actionsContainer.createEl("button", {
			cls: iconBtnCls,
			attr: { "aria-label": "Generate cards" },
		});
		setIcon(generateBtn, "sparkles");
		this.events.addEventListener(generateBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onGenerateCards(note.path);
		});

		const moreBtn = actionsContainer.createEl("button", {
			cls: iconBtnCls,
			attr: { "aria-label": "More actions" },
		});
		setIcon(moreBtn, "more-horizontal");
		this.events.addEventListener(moreBtn, "click", (e) => {
			e.stopPropagation();
			this.showContextMenu(e, note, projectName);
		});
	}

	private showContextMenu(
		e: MouseEvent,
		note: ProjectNoteInfo,
		projectName: string | null
	): void {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle("Open note")
				.setIcon("file-text")
				.onClick(() => this.props.onOpenNote(note.path))
		);
		menu.addItem((item) =>
			item
				.setTitle("Start review")
				.setIcon("play")
				.onClick(() =>
					this.props.onStartReview({ sourceNoteFilters: [note.name] })
				)
		);
		menu.addItem((item) =>
			item
				.setTitle("Custom study")
				.setIcon("sliders-horizontal")
				.onClick(() =>
					this.props.onCustomStudy({ sourceNoteFilters: [note.name] })
				)
		);
		menu.addItem((item) =>
			item
				.setTitle("Generate cards")
				.setIcon("sparkles")
				.onClick(() => this.props.onGenerateCards(note.path))
		);
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Add to project...")
				.setIcon("folder-plus")
				.onClick(() => this.props.onAddToProject(note.path))
		);
		if (projectName) {
			menu.addItem((item) =>
				item
					.setTitle(`Remove from "${projectName}"`)
					.setIcon("folder-minus")
					.onClick(() =>
						this.props.onRemoveFromProject(note.path, projectName)
					)
			);
		}

		menu.showAtMouseEvent(e);
	}

	updateSelected(isSelected: boolean): void {
		this.props.isSelected = isSelected;

		if (this.element) {
			if (isSelected) {
				this.element.addClass("ep:bg-obs-interactive/10");
			} else {
				this.element.removeClass("ep:bg-obs-interactive/10");
			}
		}

		if (this.checkboxEl) {
			this.checkboxEl.checked = isSelected;
		}
	}

	destroy(): void {
		this.cardCountDisplay?.destroy();
		this.cardCountDisplay = null;
		this.checkboxEl = null;
		super.destroy();
	}
}

export function createNoteHubNoteRow(
	container: HTMLElement,
	props: NoteHubNoteRowProps
): NoteHubNoteRow {
	const row = new NoteHubNoteRow(container, props);
	row.render();
	return row;
}
