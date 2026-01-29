/**
 * Expandable Add Card Component
 * Empty card placeholder for adding new flashcards inline
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../../component.base";
import {
	createEditableTextField,
	EditableTextField,
	TOOLBAR_BUTTONS,
} from "../../components";

export interface ExpandableAddCardProps {
	isExpanded: boolean;
	onToggleExpand: () => void;
	onSave: (question: string, answer: string) => void;
	onSaveWithAI: (question: string, answer: string, aiInstruction: string) => void;
	onCancel: () => void;
}

/**
 * Expandable add card for inline flashcard creation
 */
export class ExpandableAddCard extends BaseComponent {
	private props: ExpandableAddCardProps;
	private questionField: EditableTextField | null = null;
	private answerField: EditableTextField | null = null;
	private questionValue: string = "";
	private answerValue: string = "";
	private aiInstructionValue: string = "";
	private isAiAssistExpanded: boolean = false;

	constructor(container: HTMLElement, props: ExpandableAddCardProps) {
		super(container);
		this.props = props;
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

		const { isExpanded } = this.props;

		this.element = this.container.createDiv({
			cls: "ep:mt-2",
		});

		if (isExpanded) {
			this.renderExpandedMode();
		} else {
			this.renderCollapsedMode();
		}
	}

	private renderCollapsedMode(): void {
		if (!this.element) return;

		const { onToggleExpand } = this.props;

		const placeholder = this.element.createDiv({
			cls: "ep:flex ep:items-center ep:justify-center ep:gap-2 ep:py-3 ep:px-4 ep:border ep:border-dashed ep:border-obs-border ep:rounded ep:bg-transparent ep:text-obs-muted ep:text-ui-small ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:hover:border-obs-modifier-border-hover",
		});

		const iconEl = placeholder.createSpan({ cls: "ep:w-4 ep:h-4" });
		setIcon(iconEl, "plus");

		placeholder.createSpan({ text: "Add new flashcard" });

		this.events.addEventListener(placeholder, "click", onToggleExpand);
	}

	private renderExpandedMode(): void {
		if (!this.element) return;

		const { onSave, onCancel } = this.props;

		// Reset values
		this.questionValue = "";
		this.answerValue = "";

		const editContainer = this.element.createDiv({
			cls: "ep:p-3 ep:bg-obs-secondary ep:border ep:border-obs-interactive ep:rounded",
		});

		// Question field
		editContainer.createDiv({
			cls: "ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:mb-1",
			text: "Question",
		});

		const questionWrapper = editContainer.createDiv({ cls: "ep:mb-3" });
		this.questionField = createEditableTextField(questionWrapper, {
			initialValue: "",
			placeholder: "Enter question...",
			showToolbar: true,
			toolbarButtons: TOOLBAR_BUTTONS.UNIFIED,
			toolbarPositioned: false,
			autoFocus: true,
			onChange: (value) => {
				this.questionValue = value;
			},
		});

		// Answer field
		editContainer.createDiv({
			cls: "ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:mb-1",
			text: "Answer",
		});

		const answerWrapper = editContainer.createDiv({ cls: "ep:mb-3" });
		this.answerField = createEditableTextField(answerWrapper, {
			initialValue: "",
			placeholder: "Enter answer...",
			showToolbar: true,
			toolbarButtons: TOOLBAR_BUTTONS.UNIFIED,
			toolbarPositioned: false,
			autoFocus: false,
			onChange: (value) => {
				this.answerValue = value;
			},
		});

		// AI Assist toggle section
		const aiAssistSection = editContainer.createDiv({
			cls: "ep:mt-3 ep:pt-3 ep:border-t ep:border-obs-border",
		});

		const aiToggleRow = aiAssistSection.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors",
		});

		const toggleIcon = aiToggleRow.createSpan({ cls: "ep:w-4 ep:h-4 ep:transition-transform" });
		setIcon(toggleIcon, this.isAiAssistExpanded ? "chevron-down" : "chevron-right");

		aiToggleRow.createSpan({
			text: "AI Assist",
			cls: "ep:text-ui-smaller ep:font-medium",
		});

		this.events.addEventListener(aiToggleRow, "click", () => {
			this.isAiAssistExpanded = !this.isAiAssistExpanded;
			this.render();
		});

		// AI instruction textarea (shown when expanded)
		if (this.isAiAssistExpanded) {
			const aiInputWrapper = aiAssistSection.createDiv({ cls: "ep:mt-2" });
			const aiTextarea = aiInputWrapper.createEl("textarea", {
				cls: "ep:w-full ep:min-h-16 ep:p-2 ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:text-obs-normal ep:text-ui-smaller ep:resize-y ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
				placeholder: "np. stwórz podobne fiszki, rozwiń temat, dodaj więcej przykładów...",
			});
			aiTextarea.value = this.aiInstructionValue;
			this.events.addEventListener(aiTextarea, "input", () => {
				this.aiInstructionValue = aiTextarea.value;
			});
		}

		// Buttons
		const buttonsRow = editContainer.createDiv({
			cls: "ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border",
		});

		const cancelBtn = buttonsRow.createEl("button", {
			text: "Cancel",
			cls: "ep:py-1.5 ep:px-3 ep:text-ui-smaller ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
		});
		this.events.addEventListener(cancelBtn, "click", () => {
			this.questionValue = "";
			this.answerValue = "";
			this.aiInstructionValue = "";
			this.isAiAssistExpanded = false;
			onCancel();
		});

		// Dynamic button based on AI instruction
		const hasAiInstruction = this.aiInstructionValue.trim().length > 0;
		const addBtn = buttonsRow.createEl("button", {
			text: hasAiInstruction ? "Add & Generate" : "Add flashcard",
			cls: "mod-cta ep:py-1.5 ep:px-3 ep:text-ui-smaller ep:rounded",
		});
		this.events.addEventListener(addBtn, "click", () => {
			const question = this.questionField?.getValue() || this.questionValue;
			const answer = this.answerField?.getValue() || this.answerValue;

			if (question.trim() && answer.trim()) {
				if (hasAiInstruction) {
					this.props.onSaveWithAI(question, answer, this.aiInstructionValue);
				} else {
					onSave(question, answer);
				}
				// Reset after save
				this.questionValue = "";
				this.answerValue = "";
				this.aiInstructionValue = "";
				this.isAiAssistExpanded = false;
			}
		});
	}

	updateProps(props: Partial<ExpandableAddCardProps>): void {
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
 * Factory function to create and render expandable add card
 */
export function createExpandableAddCard(
	container: HTMLElement,
	props: ExpandableAddCardProps
): ExpandableAddCard {
	const card = new ExpandableAddCard(container, props);
	card.render();
	return card;
}
