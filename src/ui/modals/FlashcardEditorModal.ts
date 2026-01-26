/**
 * Flashcard Editor Modal
 * Preview/edit toggle like ReviewView
 * Supports both adding new flashcards and editing existing ones
 */
import { App, Notice, MarkdownRenderer, Component } from "obsidian";
import { BaseModal } from "./BaseModal";
import { MediaPickerModal } from "./MediaPickerModal";
import type { FSRSFlashcardItem } from "../../types";
import { ImageService } from "../../services/image";
import {
	createEditableTextField,
	EditableTextField,
	TOOLBAR_BUTTONS,
	ToolbarButton,
	insertAtTextareaCursor,
} from "../components";

export interface FlashcardEditorResult {
	cancelled: boolean;
	question: string;
	answer: string;
	/** New source note path if user changed it (for move operation) */
	newSourceNotePath?: string;
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
	/** Pre-fill question (for copying cards) */
	prefillQuestion?: string;
	/** Pre-fill answer (for copying cards) */
	prefillAnswer?: string;
}

/**
 * Modal for creating/editing flashcards with preview/edit toggle
 */
export class FlashcardEditorModal extends BaseModal {
	private options: FlashcardEditorModalOptions;
	private resolvePromise: ((result: FlashcardEditorResult) => void) | null = null;
	private hasSubmitted = false;

	// EditableTextField instances (only active when editing)
	private questionField: EditableTextField | null = null;
	private answerField: EditableTextField | null = null;
	private saveButton: HTMLButtonElement | null = null;

	// Content area for re-rendering
	private fieldsContainer: HTMLElement | null = null;

	// Edit state
	private editingField: "question" | "answer" | null = null;

	// Stored values (for preview/edit toggle)
	private questionValue: string = "";
	private answerValue: string = "";

	// Markdown rendering component
	private renderComponent: Component | null = null;

	// Image service
	private imageService: ImageService | null = null;

	// Source change state
	private sourceEditing = false;
	private newSourceNotePath: string | null = null;
	private newSourceNoteName: string | null = null;
	private sourceContainer: HTMLElement | null = null;

	constructor(app: App, options: FlashcardEditorModalOptions) {
		super(app, {
			title: options.mode === "add" ? "Add New Flashcard" : "Edit Flashcard",
			width: "600px",
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
		// Initialize services BEFORE super.onOpen() which calls renderBody()
		this.imageService = new ImageService(this.app);

		// Initialize markdown rendering component
		this.renderComponent = new Component();
		this.renderComponent.load();

		// Now call super which will call renderBody()
		super.onOpen();
		this.contentEl.addClass("episteme-flashcard-editor-modal");
	}

	protected renderBody(container: HTMLElement): void {
		const { mode, card, sourceNoteName } = this.options;

		// Initialize stored values
		this.questionValue = card?.question || this.options.prefillQuestion || "";
		this.answerValue = card?.answer || this.options.prefillAnswer || "";

		// If both fields are empty, start in edit mode for question
		if (!this.questionValue.trim() && !this.answerValue.trim()) {
			this.editingField = "question";
		}

		// Fields container (for re-rendering)
		this.fieldsContainer = container.createDiv({ cls: "ep:flex ep:flex-col" });
		this.renderFields();

		// Source info (at bottom) - clickable to change source note
		this.renderSourceSection(container);

		// Buttons
		this.renderButtons(container);

		// Setup keyboard shortcuts
		this.setupKeyboardShortcuts(container);
	}

	/**
	 * Render both fields (question and answer)
	 */
	private renderFields(): void {
		if (!this.fieldsContainer) return;

		// Clean up existing fields
		this.cleanupFields();
		this.fieldsContainer.empty();

		// Question section with label
		const questionSection = this.fieldsContainer.createDiv({ cls: "ep:mb-4" });
		questionSection.createDiv({
			cls: "ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:uppercase ep:tracking-wide ep:mb-2",
			text: "Question",
		});
		this.renderField(questionSection, this.questionValue, "question");

		// Answer section with label
		const answerSection = this.fieldsContainer.createDiv();
		answerSection.createDiv({
			cls: "ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:uppercase ep:tracking-wide ep:mb-2",
			text: "Answer",
		});
		this.renderField(answerSection, this.answerValue, "answer");
	}

	/**
	 * Clean up existing field components
	 */
	private cleanupFields(): void {
		// Clean up EditableTextField instances
		if (this.questionField) {
			this.questionField.destroy();
			this.questionField = null;
		}
		if (this.answerField) {
			this.answerField.destroy();
			this.answerField = null;
		}
	}

	/**
	 * Render source section (clickable to change source note)
	 */
	private renderSourceSection(container: HTMLElement): void {
		const { card, sourceNoteName } = this.options;

		// Show source from: newSourceNoteName (if changed) > card.sourceNoteName > options.sourceNoteName
		const displaySourceName = this.newSourceNoteName
			?? card?.sourceNoteName
			?? sourceNoteName;

		if (!displaySourceName) return;

		this.sourceContainer = container.createDiv({ cls: "ep:flex ep:items-center ep:justify-end ep:mt-3" });
		this.renderSourceDisplay();
	}

	/**
	 * Render source in display mode (clickable text)
	 */
	private renderSourceDisplay(): void {
		if (!this.sourceContainer) return;
		this.sourceContainer.empty();

		const { mode, card, sourceNoteName } = this.options;
		const displaySourceName = this.newSourceNoteName
			?? card?.sourceNoteName
			?? sourceNoteName;

		if (!displaySourceName) return;

		const sourceEl = this.sourceContainer.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1.5 ep:text-obs-faint ep:text-ui-smaller",
		});
		sourceEl.createSpan({ text: "Source:" });
		const nameSpan = sourceEl.createSpan({
			text: displaySourceName,
			cls: "ep:text-obs-muted",
		});

		// Only allow changing source in edit mode
		if (mode === "edit") {
			nameSpan.addClass("ep:cursor-pointer", "ep:transition-all", "ep:hover:text-obs-normal", "ep:hover:underline");
			nameSpan.addEventListener("click", () => this.startSourceEdit());
		}
	}

	/**
	 * Start editing source (show search input)
	 */
	private startSourceEdit(): void {
		if (!this.sourceContainer) return;
		// Source editing disabled (autocomplete removed)
		new Notice("Source editing is not available");
	}

	/**
	 * Cancel source editing and restore display
	 */
	private cancelSourceEdit(): void {
		this.sourceEditing = false;
		this.renderSourceDisplay();
	}

	/**
	 * Render a single field (question or answer)
	 */
	private renderField(
		container: HTMLElement,
		content: string,
		field: "question" | "answer"
	): void {
		const fieldGroup = container.createDiv({ cls: "ep:mb-0" });
		const isEditing = this.editingField === field;
		const isEmpty = !content.trim();

		// Only the actively edited field uses edit mode
		// This prevents multiple autofocus fields causing infinite re-render loops
		if (isEditing) {
			this.renderEditMode(fieldGroup, content, field);
		} else if (isEmpty) {
			// Show clickable placeholder for empty fields
			this.renderEmptyPlaceholder(fieldGroup, field);
		} else {
			// Preview mode for non-empty content
			this.renderPreviewMode(fieldGroup, content, field);
		}
	}

	/**
	 * Render field in preview mode (rendered markdown)
	 */
	private renderPreviewMode(
		container: HTMLElement,
		content: string,
		field: "question" | "answer"
	): void {
		const baseCls = "ep:p-4 ep:min-h-20 ep:cursor-text ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-primary ep:text-ui-small ep:text-center ep:hover:border-obs-interactive ep:transition-colors";
		const answerCls = field === "answer" ? "ep:text-obs-muted" : "";
		const preview = container.createDiv({
			cls: `${baseCls} ${answerCls} episteme-card-markdown`.trim(),
		});

		// Render markdown
		if (this.renderComponent) {
			void MarkdownRenderer.render(
				this.app,
				content,
				preview,
				this.options.currentFilePath,
				this.renderComponent
			);
		}

		// Click to edit
		preview.addEventListener("click", () => {
			this.editingField = field;
			this.renderFields();
		});
	}

	/**
	 * Render empty placeholder (clickable to start editing)
	 */
	private renderEmptyPlaceholder(
		container: HTMLElement,
		field: "question" | "answer"
	): void {
		const placeholder = container.createDiv({
			cls: "ep:p-4 ep:min-h-20 ep:cursor-text ep:rounded-lg ep:border ep:border-dashed ep:border-obs-border ep:text-obs-muted ep:text-ui-small ep:text-center ep:hover:border-obs-interactive ep:transition-colors ep:flex ep:items-center ep:justify-center",
		});
		placeholder.textContent = field === "question"
			? "Click to add question..."
			: "Click to add answer...";

		// Click to edit
		placeholder.addEventListener("click", () => {
			this.editingField = field;
			this.renderFields();
		});
	}

	/**
	 * Render field in edit mode (textarea with toolbar)
	 */
	private renderEditMode(
		container: HTMLElement,
		content: string,
		field: "question" | "answer"
	): void {
		// Wrap edit field in a styled container
		const editContainer = container.createDiv({
			cls: "ep:rounded-lg ep:border ep:border-obs-interactive ep:bg-obs-primary ep:p-3",
		});

		const editField = createEditableTextField(editContainer, {
			initialValue: content,
			placeholder: field === "question" ? "Type your question here..." : "Type your answer here...",
			showToolbar: true,
			toolbarButtons: this.getToolbarButtons(),
			toolbarPositioned: false,
			field,
			autoFocus: true,
			invisibleTextarea: true,
			onSave: (value) => {
				// Save value and exit edit mode
				if (field === "question") {
					this.questionValue = value;
				} else {
					this.answerValue = value;
				}
				this.editingField = null;
				this.renderFields();
				this.validateForm();
			},
			onTab: () => {
				// Save current and switch to other field
				const currentValue = editField.getRawValue();
				if (field === "question") {
					this.questionValue = currentValue;
					this.editingField = "answer";
				} else {
					this.answerValue = currentValue;
					this.editingField = "question";
				}
				this.renderFields();
			},
			onChange: () => {
				// Update stored value on change
				if (field === "question") {
					this.questionValue = editField.getRawValue();
				} else {
					this.answerValue = editField.getRawValue();
				}
				this.validateForm();
			},
		});

		// Store reference
		if (field === "question") {
			this.questionField = editField;
		} else {
			this.answerField = editField;
		}

		// Attach image paste handler
		const textarea = editField.getTextarea();
		if (textarea) {
			textarea.addEventListener("paste", (e) => {
				void this.handleImagePaste(e, textarea);
			});
		}
	}

	/**
	 * Get toolbar buttons with Media picker added
	 */
	private getToolbarButtons(): ToolbarButton[] {
		return [
			...TOOLBAR_BUTTONS.EDITOR,
			{
				id: "media",
				label: "Media",
				title: "Insert Image or Video",
				shortcut: "Ctrl+Shift+I",
				action: { type: "custom", handler: () => void this.openMediaPicker() },
			},
			{
				id: "help",
				label: "?",
				title: "Show keyboard shortcuts",
				shortcut: "Ctrl+/",
				action: { type: "custom", handler: () => this.showKeyboardShortcuts() },
			},
		];
	}

	/**
	 * Render action buttons
	 */
	private renderButtons(container: HTMLElement): void {
		const buttonsEl = container.createDiv({ cls: "ep:flex ep:justify-end ep:gap-3 ep:mt-5 ep:pt-4 ep:border-t ep:border-obs-border" });

		const cancelBtn = buttonsEl.createEl("button", {
			text: "Cancel",
			cls: "ep:py-2.5 ep:px-5 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});
		cancelBtn.addEventListener("click", () => this.close());

		const buttonText = this.options.mode === "add" ? "Add flashcard" : "Save changes";
		this.saveButton = buttonsEl.createEl("button", {
			text: buttonText,
			cls: "ep:py-2.5 ep:px-5 ep:bg-obs-interactive ep:text-white ep:border-none ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-interactive-hover ep:disabled:opacity-50 ep:disabled:cursor-not-allowed",
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

			// Escape to cancel (only if not inside textarea for normal editing)
			if (e.key === "Escape" && !(e.target instanceof HTMLTextAreaElement)) {
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

			// Formatting shortcuts - delegate to focused field
			const focusedField = this.getFocusedField();
			if (!focusedField) return;

			// Ctrl+B for bold
			if ((e.metaKey || e.ctrlKey) && e.key === "b") {
				e.preventDefault();
				focusedField.executeButtonAction("bold");
				return;
			}

			// Ctrl+I for italic
			if ((e.metaKey || e.ctrlKey) && e.key === "i") {
				e.preventDefault();
				focusedField.executeButtonAction("italic");
				return;
			}

			// Ctrl+K for wiki link
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				focusedField.executeButtonAction("wiki");
				return;
			}

			// Ctrl+M for math
			if ((e.metaKey || e.ctrlKey) && e.key === "m") {
				e.preventDefault();
				focusedField.executeButtonAction("math");
				return;
			}

			// Ctrl+L for list
			if ((e.metaKey || e.ctrlKey) && e.key === "l") {
				e.preventDefault();
				focusedField.executeButtonAction("list");
				return;
			}

			// Ctrl+Shift+I for media picker
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "i") {
				e.preventDefault();
				void this.openMediaPicker();
				return;
			}
		});
	}

	/**
	 * Get the currently focused EditableTextField
	 */
	private getFocusedField(): EditableTextField | null {
		const activeElement = document.activeElement;
		const questionTextarea = this.questionField?.getTextarea();
		const answerTextarea = this.answerField?.getTextarea();

		if (activeElement === questionTextarea) {
			return this.questionField;
		} else if (activeElement === answerTextarea) {
			return this.answerField;
		}
		return null;
	}

	/**
	 * Show keyboard shortcuts modal
	 */
	private showKeyboardShortcuts(): void {
		new KeyboardShortcutsModal(this.app).open();
	}

	/**
	 * Handle image paste from clipboard
	 */
	private async handleImagePaste(e: ClipboardEvent, textarea: HTMLTextAreaElement): Promise<void> {
		const items = e.clipboardData?.items;
		if (!items || !this.imageService) return;

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item && item.type.startsWith("image/")) {
				e.preventDefault();
				const blob = item.getAsFile();
				if (!blob) return;

				if (this.imageService.isBlobTooLarge(blob)) {
					const size = this.imageService.formatFileSize(blob.size);
					new Notice(`Image is too large (${size}). Maximum size is 5MB.`);
					return;
				}

				try {
					new Notice("Saving image...");
					const path = await this.imageService.saveImageFromClipboard(blob);
					const markdown = this.imageService.buildImageMarkdown(path);
					this.insertAtCursor(textarea, markdown);
					new Notice("Image inserted");
				} catch (error) {
					console.error("[Episteme] Failed to save pasted image:", error);
					new Notice("Failed to save image");
				}
				return;
			}
		}
	}

	/**
	 * Open the media picker modal (images and videos)
	 */
	private async openMediaPicker(): Promise<void> {
		const modal = new MediaPickerModal(this.app, {
			currentFilePath: this.options.currentFilePath,
		});

		const result = await modal.openAndWait();

		if (!result.cancelled && result.markdown) {
			// Find the currently focused textarea
			const focusedField = this.getFocusedField();
			const textarea = focusedField?.getTextarea() || this.questionField?.getTextarea();

			if (textarea) {
				this.insertAtCursor(textarea, result.markdown);
			}
		}
	}

	/**
	 * Insert text at cursor position in textarea
	 */
	private insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
		insertAtTextareaCursor(textarea, text);
		textarea.focus();
	}

	/**
	 * Check if the form is valid
	 */
	private isFormValid(): boolean {
		// Use stored values (they're updated on every change)
		const question = this.questionValue.trim();
		const answer = this.answerValue.trim();
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
		// Use stored values
		const question = this.questionValue.trim();
		const answer = this.answerValue.trim();

		if (!question || !answer) return;

		this.hasSubmitted = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				question,
				answer,
				newSourceNotePath: this.newSourceNotePath ?? undefined,
			});
			this.resolvePromise = null;
		}
		this.close();
	}

	onClose(): void {
		// Clean up field components
		this.cleanupFields();

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
			{ key: "Ctrl+Shift+I", action: "Insert media (image/video)" },
			{ key: "Ctrl+V", action: "Paste (images auto-saved)" },
			{ key: "Ctrl+/", action: "Show this help" },
		];

		const list = container.createDiv({ cls: "ep:flex ep:flex-col ep:gap-2" });

		for (const shortcut of shortcuts) {
			const item = list.createDiv({ cls: "ep:flex ep:justify-between ep:items-center ep:py-2 ep:px-3 ep:bg-obs-secondary ep:rounded-md" });

			item.createSpan({ cls: "ep:py-1 ep:px-2 ep:bg-obs-border ep:rounded ep:font-mono ep:text-ui-smaller ep:font-medium ep:text-obs-normal", text: shortcut.key });
			item.createSpan({ cls: "ep:text-ui-small ep:text-obs-normal", text: shortcut.action });
		}
	}
}
