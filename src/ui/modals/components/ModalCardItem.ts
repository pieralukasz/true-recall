/**
 * Modal Card Item Component
 * Compact card display for FlashcardReviewModal
 * Based on CompactCardItem pattern but simplified for modal use
 */
import { App, Component, Menu, MarkdownRenderer, setIcon } from "obsidian";
import { BaseComponent } from "../../component.base";
import {
	createEditableTextField,
	EditableTextField,
	TOOLBAR_BUTTONS,
} from "../../components";
import type { FlashcardItem } from "../../../types";

export interface ModalCardItemProps {
	card: FlashcardItem;
	index: number;
	app: App;
	component: Component;
	isExpanded: boolean;
	isEditing: boolean;
	editingField: "question" | "answer" | null;
	isSelectionMode: boolean;
	isSelected: boolean;
	onToggleExpand: () => void;
	onStartEdit: (field: "question" | "answer") => void;
	onSaveEdit: (question: string, answer: string) => void;
	onCancelEdit: () => void;
	onDelete: () => void;
	onToggleSelect: () => void;
	onEnterSelectionMode: () => void;
}

const LONG_PRESS_DURATION = 500;

/**
 * Modal card item with expandable answer and inline editing
 */
export class ModalCardItem extends BaseComponent {
	private props: ModalCardItemProps;
	private questionField: EditableTextField | null = null;
	private answerField: EditableTextField | null = null;
	private editedQuestion: string = "";
	private editedAnswer: string = "";
	private longPressTimer: ReturnType<typeof setTimeout> | null = null;
	private didLongPress = false;

	constructor(container: HTMLElement, props: ModalCardItemProps) {
		super(container);
		this.props = props;
		this.editedQuestion = props.card.question;
		this.editedAnswer = props.card.answer;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
			this.questionField?.destroy();
			this.answerField?.destroy();
			this.questionField = null;
			this.answerField = null;
		}

		const { isExpanded, isEditing } = this.props;

		this.element = this.container.createDiv({
			cls: "ep:flex ep:flex-col ep:mb-2 ep:rounded ep:bg-obs-secondary ep:border ep:border-obs-border ep:transition-colors ep:hover:border-obs-interactive",
		});

		if (isEditing) {
			this.renderEditMode();
		} else if (isExpanded) {
			this.renderExpandedMode();
		} else {
			this.renderCollapsedMode();
		}
	}

	private renderCollapsedMode(): void {
		if (!this.element) return;

		const { card, app, component, onToggleExpand, isSelectionMode, isSelected, onToggleSelect } = this.props;

		const mainRow = this.element.createDiv({
			cls: "ep:flex ep:items-start ep:gap-2 ep:p-2.5 ep:cursor-pointer",
		});

		// Setup long press for entering selection mode
		this.setupLongPress(mainRow);

		// Selection checkbox (shown in selection mode)
		if (isSelectionMode) {
			const checkbox = mainRow.createEl("input", {
				type: "checkbox",
				cls: "ep:w-4 ep:h-4 ep:mt-0.5 ep:accent-obs-interactive ep:cursor-pointer ep:flex-shrink-0",
			});
			checkbox.checked = isSelected;
			this.events.addEventListener(checkbox, "click", (e) => {
				e.stopPropagation();
				onToggleSelect();
			});
		} else {
			// Status dot (new cards are blue) - only show when not in selection mode
			mainRow.createSpan({
				cls: "ep:w-2 ep:h-2 ep:rounded-full ep:flex-shrink-0 ep:mt-1.5 ep:bg-blue-500",
				attr: { title: "New" },
			});
		}

		// Question content (markdown rendered)
		const questionEl = mainRow.createDiv({
			cls: "ep:flex-1 ep:text-ui-small ep:text-obs-normal ep:line-clamp-2 true-recall-card-markdown",
		});
		void MarkdownRenderer.render(app, card.question, questionEl, "", component);

		// Menu button (hide in selection mode)
		if (!isSelectionMode) {
			const menuBtn = mainRow.createEl("button", {
				cls: "clickable-icon ep:opacity-0 ep:group-hover:opacity-100 ep:transition-opacity",
				attr: { "aria-label": "Card actions" },
			});
			setIcon(menuBtn, "more-vertical");
			this.events.addEventListener(menuBtn, "click", (e) => {
				e.stopPropagation();
				this.showCardMenu(e);
			});
		}

		// Make row expandable - add group class for hover
		this.element.addClass("group");

		// Add selected visual style
		if (isSelected) {
			this.element.addClass("ep:bg-obs-interactive/10");
		}

		this.events.addEventListener(mainRow, "click", (e) => {
			// Skip if long press just happened
			if (this.didLongPress) {
				this.didLongPress = false;
				return;
			}
			if ((e.target as HTMLElement).closest("button")) return;
			if ((e.target as HTMLElement).closest("input[type='checkbox']")) return;
			if (isSelectionMode) {
				onToggleSelect();
			} else {
				onToggleExpand();
			}
		});
	}

	private setupLongPress(element: HTMLElement): void {
		this.events.addEventListener(element, "pointerdown", () => {
			this.didLongPress = false;
			this.longPressTimer = setTimeout(() => {
				this.didLongPress = true;
				this.props.onEnterSelectionMode();
			}, LONG_PRESS_DURATION);
		});

		this.events.addEventListener(element, "pointerup", () => {
			if (this.longPressTimer) {
				clearTimeout(this.longPressTimer);
				this.longPressTimer = null;
			}
		});

		this.events.addEventListener(element, "pointerleave", () => {
			if (this.longPressTimer) {
				clearTimeout(this.longPressTimer);
				this.longPressTimer = null;
			}
		});
	}

	private renderExpandedMode(): void {
		if (!this.element) return;

		const { card, app, component, onToggleExpand, onStartEdit } = this.props;

		// Question section
		const questionSection = this.element.createDiv({
			cls: "ep:p-2.5 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:rounded-t ep:transition-colors",
		});

		const questionRow = questionSection.createDiv({
			cls: "ep:flex ep:items-start ep:gap-2",
		});

		// Status dot
		questionRow.createSpan({
			cls: "ep:w-2 ep:h-2 ep:rounded-full ep:flex-shrink-0 ep:mt-1.5 ep:bg-blue-500",
			attr: { title: "New" },
		});

		// Question content
		const questionContent = questionRow.createDiv({
			cls: "ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown",
		});
		void MarkdownRenderer.render(app, card.question, questionContent, "", component);

		// Menu button
		const menuBtn = questionRow.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Card actions" },
		});
		setIcon(menuBtn, "more-vertical");
		this.events.addEventListener(menuBtn, "click", (e) => {
			e.stopPropagation();
			this.showCardMenu(e);
		});

		// Click to collapse
		this.events.addEventListener(questionSection, "click", (e) => {
			if ((e.target as HTMLElement).closest("button")) return;
			onToggleExpand();
		});

		// Divider
		this.element.createDiv({
			cls: "ep:border-t ep:border-obs-border",
		});

		// Answer section
		const answerSection = this.element.createDiv({
			cls: "ep:p-2.5 ep:pl-6 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:rounded-b ep:transition-colors",
		});

		const answerContent = answerSection.createDiv({
			cls: "ep:text-ui-small ep:text-obs-muted true-recall-card-markdown",
		});
		void MarkdownRenderer.render(app, card.answer, answerContent, "", component);

		// Click to collapse
		this.events.addEventListener(answerSection, "click", () => {
			onToggleExpand();
		});

		// Edit hint
		const hintEl = this.element.createDiv({
			cls: "ep:text-center ep:text-ui-smaller ep:text-obs-faint ep:py-1 ep:cursor-pointer ep:hover:text-obs-muted",
		});
		hintEl.textContent = "Click to edit";
		this.events.addEventListener(hintEl, "click", () => onStartEdit("question"));
	}

	private renderEditMode(): void {
		if (!this.element) return;

		const { card, editingField, onSaveEdit, onCancelEdit } = this.props;

		// Initialize edited values
		this.editedQuestion = card.question;
		this.editedAnswer = card.answer;

		const editContainer = this.element.createDiv({
			cls: "ep:p-3",
		});

		// Question field
		editContainer.createDiv({
			cls: "ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:mb-1",
			text: "Question",
		});

		const questionWrapper = editContainer.createDiv({ cls: "ep:mb-3" });
		this.questionField = createEditableTextField(questionWrapper, {
			initialValue: card.question,
			showToolbar: true,
			toolbarButtons: TOOLBAR_BUTTONS.UNIFIED,
			toolbarPositioned: false,
			autoFocus: editingField === "question",
			onChange: (value) => {
				this.editedQuestion = value;
			},
		});

		// Answer field
		editContainer.createDiv({
			cls: "ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:mb-1",
			text: "Answer",
		});

		const answerWrapper = editContainer.createDiv({ cls: "ep:mb-3" });
		this.answerField = createEditableTextField(answerWrapper, {
			initialValue: card.answer,
			showToolbar: true,
			toolbarButtons: TOOLBAR_BUTTONS.UNIFIED,
			toolbarPositioned: false,
			autoFocus: editingField === "answer",
			onChange: (value) => {
				this.editedAnswer = value;
			},
		});

		// Buttons
		const buttonsRow = editContainer.createDiv({
			cls: "ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border",
		});

		const cancelBtn = buttonsRow.createEl("button", {
			text: "Cancel",
			cls: "ep:py-1.5 ep:px-3 ep:text-ui-smaller ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
		});
		this.events.addEventListener(cancelBtn, "click", onCancelEdit);

		const saveBtn = buttonsRow.createEl("button", {
			text: "Save",
			cls: "mod-cta ep:py-1.5 ep:px-3 ep:text-ui-smaller ep:rounded",
		});
		this.events.addEventListener(saveBtn, "click", () => {
			const question = this.questionField?.getValue() || this.editedQuestion;
			const answer = this.answerField?.getValue() || this.editedAnswer;
			onSaveEdit(question, answer);
		});
	}

	private showCardMenu(e: MouseEvent): void {
		const { onStartEdit, onDelete } = this.props;
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle("Edit")
				.setIcon("pencil")
				.onClick(() => onStartEdit("question"));
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle("Delete")
				.setIcon("trash-2")
				.onClick(() => onDelete());
		});

		menu.showAtMouseEvent(e);
	}

	updateProps(props: Partial<ModalCardItemProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}

	destroy(): void {
		this.questionField?.destroy();
		this.answerField?.destroy();
		super.destroy();
	}
}

/**
 * Factory function to create and render modal card item
 */
export function createModalCardItem(
	container: HTMLElement,
	props: ModalCardItemProps
): ModalCardItem {
	const item = new ModalCardItem(container, props);
	item.render();
	return item;
}
