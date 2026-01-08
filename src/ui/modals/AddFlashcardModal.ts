/**
 * Add Flashcard Modal
 * Allows user to add a new flashcard during review session
 */
import { App } from "obsidian";
import { BaseModal } from "./BaseModal";

export interface AddFlashcardResult {
	cancelled: boolean;
	question: string;
	answer: string;
}

export interface AddFlashcardModalOptions {
	/** Current flashcard file path */
	currentFilePath: string;
	/** Source note name (for display) */
	sourceNoteName?: string;
	/** Current deck name */
	deck: string;
}

/**
 * Modal for adding a new flashcard during review
 */
export class AddFlashcardModal extends BaseModal {
	private options: AddFlashcardModalOptions;
	private resolvePromise: ((result: AddFlashcardResult) => void) | null = null;
	private hasSubmitted = false;

	// Input elements
	private questionInput: HTMLTextAreaElement | null = null;
	private answerInput: HTMLTextAreaElement | null = null;
	private addButton: HTMLButtonElement | null = null;

	constructor(app: App, options: AddFlashcardModalOptions) {
		super(app, {
			title: "Add New Flashcard",
			width: "500px",
		});
		this.options = options;
	}

	/**
	 * Open modal and return promise with result
	 */
	async openAndWait(): Promise<AddFlashcardResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-add-flashcard-modal");
	}

	protected renderBody(container: HTMLElement): void {
		// Info text
		if (this.options.sourceNoteName) {
			container.createEl("p", {
				text: `Adding to: ${this.options.sourceNoteName}`,
				cls: "episteme-modal-info",
			});
		}

		// Question field
		const questionGroup = container.createDiv({ cls: "episteme-form-group" });
		questionGroup.createEl("label", {
			text: "Question",
			cls: "episteme-form-label",
		});
		this.questionInput = questionGroup.createEl("textarea", {
			cls: "episteme-form-textarea",
			placeholder: "Enter your question...",
		});
		this.questionInput.rows = 3;
		this.questionInput.addEventListener("input", () => this.validateForm());

		// Answer field
		const answerGroup = container.createDiv({ cls: "episteme-form-group" });
		answerGroup.createEl("label", {
			text: "Answer",
			cls: "episteme-form-label",
		});
		this.answerInput = answerGroup.createEl("textarea", {
			cls: "episteme-form-textarea",
			placeholder: "Enter your answer...",
		});
		this.answerInput.rows = 4;
		this.answerInput.addEventListener("input", () => this.validateForm());

		// Buttons
		const buttonsEl = container.createDiv({ cls: "episteme-modal-buttons" });

		const cancelBtn = buttonsEl.createEl("button", {
			text: "Cancel",
			cls: "episteme-btn episteme-btn-secondary",
		});
		cancelBtn.addEventListener("click", () => this.close());

		this.addButton = buttonsEl.createEl("button", {
			text: "Add Flashcard",
			cls: "episteme-btn episteme-btn-primary",
		});
		this.addButton.disabled = true;
		this.addButton.addEventListener("click", () => this.handleSubmit());

		// Focus question input
		setTimeout(() => this.questionInput?.focus(), 50);

		// Handle Enter key (Cmd/Ctrl+Enter to submit)
		container.addEventListener("keydown", (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				if (!this.addButton?.disabled) {
					this.handleSubmit();
				}
			}
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();

		if (!this.hasSubmitted && this.resolvePromise) {
			this.resolvePromise({
				cancelled: true,
				question: "",
				answer: "",
			});
			this.resolvePromise = null;
		}
	}

	private validateForm(): void {
		const question = this.questionInput?.value.trim() ?? "";
		const answer = this.answerInput?.value.trim() ?? "";
		const isValid = question.length > 0 && answer.length > 0;

		if (this.addButton) {
			this.addButton.disabled = !isValid;
		}
	}

	private handleSubmit(): void {
		const question = this.questionInput?.value.trim() ?? "";
		const answer = this.answerInput?.value.trim() ?? "";

		if (!question || !answer) return;

		this.hasSubmitted = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				question,
				answer,
			});
			this.resolvePromise = null;
		}
		this.close();
	}
}
