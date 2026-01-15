/**
 * Flashcard Editor Modal
 * A modern, split-pane flashcard editor with live preview
 * Supports both adding new flashcards and editing existing ones
 */
import { App, MarkdownRenderer, Component } from "obsidian";
import { BaseModal } from "./BaseModal";
import type { FSRSFlashcardItem, FlashcardItem } from "../../types";
import { createCardReviewItem } from "../components/CardReviewItem";

export interface FlashcardEditorResult {
	cancelled: boolean;
	question: string;
	answer: string;
}

export interface FlashcardEditorModalOptions {
	/** Editor mode */
	mode: "add" | "edit";
	/** The flashcard to edit (only for mode='edit') */
	card?: FSRSFlashcardItem;
	/** Current flashcard file path */
	currentFilePath: string;
	/** Source note name (for display) */
	sourceNoteName?: string;
	/** Current deck name */
	deck: string;
	/** Pre-fill question (for copying cards) */
	prefillQuestion?: string;
	/** Pre-fill answer (for copying cards) */
	prefillAnswer?: string;
}

/**
 * Modal for creating/editing flashcards with split-pane markdown editor
 */
export class FlashcardEditorModal extends BaseModal {
	private options: FlashcardEditorModalOptions;
	private resolvePromise: ((result: FlashcardEditorResult) => void) | null = null;
	private hasSubmitted = false;

	// Editor elements
	private questionTextarea: HTMLTextAreaElement | null = null;
	private answerTextarea: HTMLTextAreaElement | null = null;
	private previewContainer: HTMLElement | null = null;
	private saveButton: HTMLButtonElement | null = null;

	// Markdown rendering component
	private renderComponent: Component | null = null;

	// Character count elements
	private questionCountEl: HTMLElement | null = null;
	private answerCountEl: HTMLElement | null = null;

	constructor(app: App, options: FlashcardEditorModalOptions) {
		super(app, {
			title: options.mode === "add" ? "Add New Flashcard" : "Edit Flashcard",
			width: "800px",
		});
		this.options = options;
	}

	/**
	 * Open modal and return promise with result
	 */
	async openAndWait(): Promise<FlashcardEditorResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-flashcard-editor-modal");

		// Initialize markdown rendering component
		this.renderComponent = new Component();
		this.renderComponent.load();
	}

	protected renderBody(container: HTMLElement): void {
		const { mode, card, sourceNoteName } = this.options;

		// Info section
		if (mode === "edit" && card?.sourceNoteName) {
			container.createEl("p", {
				text: `Source: ${card.sourceNoteName}`,
				cls: "episteme-modal-info",
			});
		} else if (mode === "add" && sourceNoteName) {
			container.createEl("p", {
				text: `Adding to: ${sourceNoteName}`,
				cls: "episteme-modal-info",
			});
		}

		// Split pane container
		const splitPane = container.createDiv({ cls: "episteme-editor-split-pane" });

		// Editor pane (left side)
		const editorPane = splitPane.createDiv({ cls: "episteme-editor-pane" });

		// Question field
		this.renderField(
			editorPane,
			"Question",
			card?.question || this.options.prefillQuestion || "",
			"question"
		);

		// Answer field
		this.renderField(
			editorPane,
			"Answer",
			card?.answer || this.options.prefillAnswer || "",
			"answer"
		);

		// Smart toolbar
		this.renderSmartToolbar(editorPane);

		// Preview pane (right side)
		this.previewContainer = splitPane.createDiv({ cls: "episteme-editor-preview" });
		this.updatePreview();

		// Buttons
		this.renderButtons(container);

		// Setup keyboard shortcuts
		this.setupKeyboardShortcuts(container);

		// Focus question textarea
		setTimeout(() => this.questionTextarea?.focus(), 50);
	}

	/**
	 * Render a single field (question or answer) with textarea and character count
	 */
	private renderField(
		container: HTMLElement,
		label: string,
		initialValue: string,
		field: "question" | "answer"
	): void {
		const fieldGroup = container.createDiv({ cls: "episteme-field-group" });

		// Label
		const labelEl = fieldGroup.createEl("label", {
			text: label,
			cls: "episteme-form-label",
		});

		// Textarea
		const textarea = fieldGroup.createEl("textarea", {
			cls: "episteme-editor-textarea",
			attr: {
				placeholder: field === "question"
					? "Type your question here... (e.g., What is the capital of France?)"
					: "Type your answer here... (e.g., **Paris**)",
				"data-field": field,
			},
		});
		textarea.value = initialValue;

		// Character count
		const countEl = fieldGroup.createSpan({
			cls: "episteme-char-count",
			text: `${initialValue.length} chars`,
		});

		// Store references
		if (field === "question") {
			this.questionTextarea = textarea;
			this.questionCountEl = countEl;
		} else {
			this.answerTextarea = textarea;
			this.answerCountEl = countEl;
		}

		// Event listeners
		textarea.addEventListener("input", () => {
			this.updateCharacterCount(field, textarea.value);
			this.updatePreview();
			this.validateForm();
		});

		textarea.addEventListener("keydown", (e) => {
			this.handleFieldKeydown(e, field);
		});
	}

	/**
	 * Render smart formatting toolbar with keyboard shortcuts
	 */
	private renderSmartToolbar(container: HTMLElement): void {
		const toolbar = container.createDiv({ cls: "episteme-smart-toolbar" });

		const buttons = [
			{
				label: "B",
				title: "Bold (Ctrl+B)",
				insert: "**",
				shortcut: "Ctrl+B",
			},
			{
				label: "I",
				title: "Italic (Ctrl+I)",
				insert: "*",
				shortcut: "Ctrl+I",
			},
			{
				label: "[[]]",
				title: "Wiki Link (Ctrl+K)",
				insert: "[[]]",
				shortcut: "Ctrl+K",
			},
			{
				label: "$$",
				title: "Math (Ctrl+M)",
				insert: "$$",
				shortcut: "Ctrl+M",
			},
			{
				label: "H1",
				title: "Heading 1 (Ctrl+Alt+1)",
				insert: "# ",
				shortcut: "Ctrl+Alt+1",
			},
			{
				label: "H2",
				title: "Heading 2 (Ctrl+Alt+2)",
				insert: "## ",
				shortcut: "Ctrl+Alt+2",
			},
			{
				label: "-",
				title: "List (Ctrl+L)",
				insert: "- ",
				shortcut: "Ctrl+L",
			},
			{
				label: ">",
				title: "Quote (Ctrl+Shift+.)",
				insert: "> ",
				shortcut: "Ctrl+Shift+.",
			},
			{
				label: "`",
				title: "Code (Ctrl+`)",
				insert: "`",
				shortcut: "Ctrl+`",
			},
		];

		for (const btn of buttons) {
			const btnEl = toolbar.createEl("button", {
				cls: "episteme-toolbar-btn",
				text: btn.label,
				attr: { title: btn.title },
			});

			btnEl.addEventListener("click", () => {
				this.insertFormatting(btn.insert);
			});
		}

		// Help button
		const helpBtn = toolbar.createEl("button", {
			cls: "episteme-toolbar-btn episteme-help-btn",
			text: "?",
			attr: { title: "Show all keyboard shortcuts (Ctrl+/)" },
		});
		helpBtn.addEventListener("click", () => this.showKeyboardShortcuts());
	}

	/**
	 * Render action buttons
	 */
	private renderButtons(container: HTMLElement): void {
		const buttonsEl = container.createDiv({ cls: "episteme-modal-buttons" });

		const cancelBtn = buttonsEl.createEl("button", {
			text: "Cancel",
			cls: "episteme-btn episteme-btn-secondary",
		});
		cancelBtn.addEventListener("click", () => this.close());

		const buttonText = this.options.mode === "add" ? "Add flashcard" : "Save changes";
		this.saveButton = buttonsEl.createEl("button", {
			text: buttonText,
			cls: "episteme-btn episteme-btn-primary",
		});
		this.saveButton.disabled = !this.isFormValid();
		this.saveButton.addEventListener("click", () => this.handleSubmit());
	}

	/**
	 * Setup keyboard shortcuts
	 */
	private setupKeyboardShortcuts(container: HTMLElement): void {
		container.addEventListener("keydown", (e) => {
			// Ctrl/Cmd+Enter to submit
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				if (!this.saveButton?.disabled) {
					this.handleSubmit();
				}
				return;
			}

			// Escape to cancel
			if (e.key === "Escape") {
				e.preventDefault();
				this.close();
				return;
			}

			// Ctrl+/ to show keyboard shortcuts
			if ((e.metaKey || e.ctrlKey) && e.key === "/") {
				e.preventDefault();
				this.showKeyboardShortcuts();
				return;
			}

			// Ctrl+B for bold
			if ((e.metaKey || e.ctrlKey) && e.key === "b") {
				e.preventDefault();
				this.insertFormatting("**");
				return;
			}

			// Ctrl+I for italic
			if ((e.metaKey || e.ctrlKey) && e.key === "i") {
				e.preventDefault();
				this.insertFormatting("*");
				return;
			}

			// Ctrl+K for wiki link
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				this.insertFormatting("[[]]");
				return;
			}

			// Ctrl+M for math
			if ((e.metaKey || e.ctrlKey) && e.key === "m") {
				e.preventDefault();
				this.insertFormatting("$$");
				return;
			}

			// Ctrl+L for list
			if ((e.metaKey || e.ctrlKey) && e.key === "l") {
				e.preventDefault();
				this.insertFormatting("- ");
				return;
			}
		});
	}

	/**
	 * Handle keydown events within textareas
	 */
	private handleFieldKeydown(e: KeyboardEvent, currentField: "question" | "answer"): void {
		// Tab to switch between fields
		if (e.key === "Tab") {
			e.preventDefault();
			const nextField = currentField === "question" ? this.answerTextarea : this.questionTextarea;
			nextField?.focus();
			return;
		}

		// Enter in question field moves to answer (unless Shift+Enter for new line)
		if (e.key === "Enter" && !e.shiftKey && currentField === "question") {
			// Only move if the cursor is at the end
			const textarea = e.target as HTMLTextAreaElement;
			if (textarea.selectionStart === textarea.value.length) {
				e.preventDefault();
				this.answerTextarea?.focus();
			}
		}
	}

	/**
	 * Insert formatting at cursor position or wrap selected text
	 */
	private insertFormatting(formatting: string): void {
		const activeElement = document.activeElement;
		if (
			!activeElement ||
			(activeElement !== this.questionTextarea && activeElement !== this.answerTextarea)
		) {
			return;
		}

		const textarea = activeElement as HTMLTextAreaElement;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		const selectedText = text.substring(start, end);

		let newText: string;
		let newCursorPos: number;

		if (selectedText) {
			// Wrap selected text
			if (formatting === "[[]]") {
				newText = text.substring(0, start) + "[[" + selectedText + "]]" + text.substring(end);
				newCursorPos = start + selectedText.length + 4;
			} else if (formatting === "$$") {
				newText = text.substring(0, start) + "$$" + selectedText + "$$" + text.substring(end);
				newCursorPos = start + selectedText.length + 4;
			} else {
				newText = text.substring(0, start) + formatting + selectedText + formatting + text.substring(end);
				newCursorPos = end + formatting.length * 2;
			}
		} else {
			// Insert at cursor
			newText = text.substring(0, start) + formatting + formatting + text.substring(end);
			newCursorPos = start + formatting.length;
		}

		textarea.value = newText;
		textarea.focus();
		textarea.setSelectionRange(newCursorPos, newCursorPos);

		// Trigger input event to update preview
		textarea.dispatchEvent(new Event("input"));
	}

	/**
	 * Update character count for a field
	 */
	private updateCharacterCount(field: "question" | "answer", value: string): void {
		const countEl = field === "question" ? this.questionCountEl : this.answerCountEl;
		if (countEl) {
			const length = value.length;
			countEl.textContent = `${length} char${length === 1 ? "" : "s"}`;

			// Add warning for long content
			countEl.toggleClass("episteme-char-count-warning", length > 200);
		}
	}

	/**
	 * Update the preview pane with rendered markdown
	 * Uses the CardReviewItem component for consistency with the rest of the app
	 */
	private updatePreview(): void {
		if (!this.previewContainer || !this.renderComponent) return;

		const question = this.questionTextarea?.value || "";
		const answer = this.answerTextarea?.value || "";

		this.previewContainer.empty();

		// Create temporary card for preview
		const tempCard: FlashcardItem = {
			question,
			answer,
			id: "preview-temp",
		};

		// Use CardReviewItem component for consistent rendering
		createCardReviewItem(this.previewContainer, {
			card: tempCard,
			filePath: this.options.currentFilePath,
			app: this.app,
			component: this.renderComponent,
			// No handlers needed for preview - make it non-clickable
			onClick: undefined,
			onDelete: undefined,
			onOpen: undefined,
			onCopy: undefined,
			onMove: undefined,
			onUnbury: undefined,
			onEditSave: undefined,
		});
	}

	/**
	 * Show keyboard shortcuts modal
	 */
	private showKeyboardShortcuts(): void {
		new KeyboardShortcutsModal(this.app).open();
	}

	/**
	 * Check if the form is valid
	 */
	private isFormValid(): boolean {
		const question = this.questionTextarea?.value.trim() || "";
		const answer = this.answerTextarea?.value.trim() || "";
		return question.length > 0 && answer.length > 0;
	}

	/**
	 * Validate and update form state
	 */
	private validateForm(): void {
		if (this.saveButton) {
			this.saveButton.disabled = !this.isFormValid();
		}
	}

	/**
	 * Handle form submission
	 */
	private handleSubmit(): void {
		const question = this.questionTextarea?.value.trim() || "";
		const answer = this.answerTextarea?.value.trim() || "";

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

	onClose(): void {
		// Clean up markdown rendering component
		if (this.renderComponent) {
			this.renderComponent.unload();
			this.renderComponent = null;
		}

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
}

/**
 * Keyboard Shortcuts Modal
 * Displays all available keyboard shortcuts
 */
export class KeyboardShortcutsModal extends BaseModal {
	constructor(app: App) {
		super(app, {
			title: "Keyboard Shortcuts",
			width: "500px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		const shortcuts = [
			{ key: "Ctrl+Enter", action: "Save and close" },
			{ key: "Escape", action: "Cancel" },
			{ key: "Tab", action: "Switch between Question/Answer" },
			{ key: "Ctrl+B", action: "Bold (**text**)" },
			{ key: "Ctrl+I", action: "Italic (*text*)" },
			{ key: "Ctrl+K", action: "Wiki link ([[link]])" },
			{ key: "Ctrl+M", action: "Math ($$formula$$)" },
			{ key: "Ctrl+L", action: "List item (- )" },
			{ key: "Ctrl+/", action: "Show this help" },
		];

		const list = container.createDiv({ cls: "episteme-shortcuts-list" });

		for (const shortcut of shortcuts) {
			const item = list.createDiv({ cls: "episteme-shortcut-item" });

			const keyEl = item.createSpan({ cls: "episteme-shortcut-key", text: shortcut.key });
			item.createSpan({ cls: "episteme-shortcut-action", text: shortcut.action });
		}
	}
}
