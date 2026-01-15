/**
 * Add Flashcard Modal
 * Allows user to add a new flashcard during review session
 * Features contenteditable markdown editor with formatting toolbar
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
	/** Pre-fill question content (for copy feature) */
	prefillQuestion?: string;
	/** Pre-fill answer content (for copy feature) */
	prefillAnswer?: string;
}

/**
 * Modal for adding a new flashcard during review
 */
export class AddFlashcardModal extends BaseModal {
	private options: AddFlashcardModalOptions;
	private resolvePromise: ((result: AddFlashcardResult) => void) | null = null;
	private hasSubmitted = false;

	// Contenteditable elements
	private questionEditEl: HTMLElement | null = null;
	private answerEditEl: HTMLElement | null = null;
	private addButton: HTMLButtonElement | null = null;

	constructor(app: App, options: AddFlashcardModalOptions) {
		super(app, {
			title: "Add New Flashcard",
			width: "600px",
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
		this.renderEditableField(
			questionGroup,
			this.options.prefillQuestion || "",
			"question"
		);

		// Answer field
		const answerGroup = container.createDiv({ cls: "episteme-form-group" });
		answerGroup.createEl("label", {
			text: "Answer",
			cls: "episteme-form-label",
		});
		this.renderEditableField(
			answerGroup,
			this.options.prefillAnswer || "",
			"answer"
		);

		// Buttons
		const buttonsEl = container.createDiv({ cls: "episteme-modal-buttons" });

		const cancelBtn = buttonsEl.createEl("button", {
			text: "Cancel",
			cls: "episteme-btn episteme-btn-secondary",
		});
		cancelBtn.addEventListener("click", () => this.close());

		this.addButton = buttonsEl.createEl("button", {
			text: "Add flashcard",
			cls: "episteme-btn episteme-btn-primary",
		});
		this.addButton.disabled = !this.isFormValid();
		this.addButton.addEventListener("click", () => this.handleSubmit());

		// Focus question input
		setTimeout(() => this.questionEditEl?.focus(), 50);

		// Handle keyboard shortcuts
		container.addEventListener("keydown", (e) => {
			// Cmd/Ctrl+Enter to submit
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				if (!this.addButton?.disabled) {
					this.handleSubmit();
				}
			}
		});
	}

	/**
	 * Render an editable field (contenteditable div) with formatting toolbar
	 */
	private renderEditableField(
		container: HTMLElement,
		content: string,
		field: "question" | "answer"
	): void {
		const editEl = container.createDiv({
			cls: "episteme-review-editable",
			attr: {
				contenteditable: "true",
				"data-field": field,
			},
		});

		// Convert markdown <br> to display format
		editEl.innerHTML = this.markdownToEditableHtml(content);

		// Store reference
		if (field === "question") {
			this.questionEditEl = editEl;
		} else {
			this.answerEditEl = editEl;
		}

		// Render toolbar under the editable field
		this.renderEditToolbar(container, editEl);

		// Event listeners
		editEl.addEventListener("input", () => this.validateForm());
		editEl.addEventListener("keydown", (e) => this.handleFieldKeydown(e, field));
	}

	/**
	 * Convert markdown content to HTML for display in contenteditable
	 * Escapes HTML to prevent XSS while preserving <br> tags for line breaks
	 */
	private markdownToEditableHtml(content: string): string {
		// Split by <br> tags (case insensitive, with optional attributes)
		const parts = content.split(/<br\s*\/?>/gi);

		// Escape each part to prevent XSS
		const escapedParts = parts.map(part => {
			const div = document.createElement("div");
			div.textContent = part;
			return div.innerHTML;
		});

		// Rejoin with safe <br> tags
		return escapedParts.join("<br>");
	}

	/**
	 * Render formatting toolbar for edit mode
	 */
	private renderEditToolbar(container: HTMLElement, editEl: HTMLElement): void {
		const toolbar = container.createDiv({ cls: "episteme-edit-toolbar" });

		const buttons = [
			{ label: "**[[]]**", title: "Bold Wiki Link", action: () => this.wrapSelection(editEl, "**[[", "]]**") },
			{ label: "⏎⏎", title: "Double Line Break", action: () => this.insertAtCursor(editEl, "<br><br>") },
			{ label: "B", title: "Bold", action: () => this.wrapSelection(editEl, "**", "**") },
			{ label: "I", title: "Italic", action: () => this.wrapSelection(editEl, "*", "*") },
			{ label: "U", title: "Underline", action: () => this.wrapSelection(editEl, "<u>", "</u>") },
			{ label: "[[]]", title: "Wiki Link", action: () => this.wrapSelection(editEl, "[[", "]]") },
			{ label: "$", title: "Math", action: () => this.wrapSelection(editEl, "$", "$") },
			{ label: "x²", title: "Superscript", action: () => this.wrapSelection(editEl, "<sup>", "</sup>") },
			{ label: "x₂", title: "Subscript", action: () => this.wrapSelection(editEl, "<sub>", "</sub>") },
		];

		for (const btn of buttons) {
			const btnEl = toolbar.createEl("button", {
				cls: "episteme-edit-toolbar-btn",
				text: btn.label,
				attr: { title: btn.title },
			});
			btnEl.addEventListener("mousedown", (e) => {
				e.preventDefault(); // Prevent blur on editEl
			});
			btnEl.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				btn.action();
				editEl.focus();
				this.validateForm();
			});
		}
	}

	/**
	 * Wrap selected text with before/after strings
	 */
	private wrapSelection(editEl: HTMLElement, before: string, after: string): void {
		editEl.focus(); // Ensure the editable element has focus

		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;

		const range = sel.getRangeAt(0);
		const selectedText = range.toString();

		if (selectedText) {
			// Wrap selected text
			const textNode = document.createTextNode(before + selectedText + after);
			range.deleteContents();
			range.insertNode(textNode);

			// Move cursor after the inserted text
			range.setStartAfter(textNode);
			range.collapse(true);
			sel.removeAllRanges();
			sel.addRange(range);
		} else {
			// No selection - insert wrapper at cursor and position cursor inside
			const textNode = document.createTextNode(before + after);
			range.insertNode(textNode);

			// Position cursor between the wrappers
			range.setStart(textNode, before.length);
			range.setEnd(textNode, before.length);
			sel.removeAllRanges();
			sel.addRange(range);
		}
	}

	/**
	 * Insert text at cursor position
	 */
	private insertAtCursor(editEl: HTMLElement, text: string): void {
		editEl.focus();

		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;

		const range = sel.getRangeAt(0);
		range.deleteContents();
		const textNode = document.createTextNode(text);
		range.insertNode(textNode);

		// Move cursor after inserted text
		range.setStartAfter(textNode);
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
	}

	/**
	 * Convert contenteditable HTML to markdown text with <br> for line breaks
	 */
	private convertEditableToMarkdown(editEl: HTMLElement): string {
		let html = editEl.innerHTML;

		// Normalize different browser line break representations
		html = html.replace(/<br\s*\/?>/gi, "\n");
		html = html.replace(/<\/div>/gi, "\n");
		html = html.replace(/<\/p>/gi, "\n");

		// Remove remaining HTML tags
		html = html.replace(/<[^>]*>/g, "");

		// Decode HTML entities
		const textarea = document.createElement("textarea");
		textarea.innerHTML = html;
		const text = textarea.value;

		// Trim trailing newlines but preserve internal ones
		const trimmed = text.replace(/\n+$/, "");

		// Replace remaining newlines with <br>
		return trimmed.replace(/\n/g, "<br>");
	}

	/**
	 * Handle keydown events within editable fields
	 */
	private handleFieldKeydown(e: KeyboardEvent, currentField: "question" | "answer"): void {
		if (e.key === "Tab") {
			e.preventDefault();
			// Switch between question and answer
			const nextField = currentField === "question" ? this.answerEditEl : this.questionEditEl;
			nextField?.focus();
		}
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

	private isFormValid(): boolean {
		const question = this.questionEditEl ? this.convertEditableToMarkdown(this.questionEditEl).trim() : "";
		const answer = this.answerEditEl ? this.convertEditableToMarkdown(this.answerEditEl).trim() : "";
		return question.length > 0 && answer.length > 0;
	}

	private validateForm(): void {
		if (this.addButton) {
			this.addButton.disabled = !this.isFormValid();
		}
	}

	private handleSubmit(): void {
		const question = this.questionEditEl ? this.convertEditableToMarkdown(this.questionEditEl).trim() : "";
		const answer = this.answerEditEl ? this.convertEditableToMarkdown(this.answerEditEl).trim() : "";

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
