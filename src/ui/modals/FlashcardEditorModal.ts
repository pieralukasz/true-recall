/**
 * Flashcard Editor Modal
 * A live preview flashcard editor with focus/blur behavior
 * Supports both adding new flashcards and editing existing ones
 */
import { App, MarkdownRenderer, Component, Notice } from "obsidian";
import { BaseModal } from "./BaseModal";
import { MediaPickerModal } from "./MediaPickerModal";
import type { FSRSFlashcardItem } from "../../types";
import { VaultSearchService, TextareaSuggest } from "../autocomplete";
import { ImageService } from "../../services/image";

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
	/** Projects associated with the card */
	projects: string[];
	/** Pre-fill question (for copying cards) */
	prefillQuestion?: string;
	/** Pre-fill answer (for copying cards) */
	prefillAnswer?: string;
	/** Folder to search for autocomplete note linking (empty = all folders) */
	autocompleteFolder?: string;
}

/**
 * Modal for creating/editing flashcards with live preview (focus/blur)
 */
export class FlashcardEditorModal extends BaseModal {
	private options: FlashcardEditorModalOptions;
	private resolvePromise: ((result: FlashcardEditorResult) => void) | null = null;
	private hasSubmitted = false;

	// Editor elements
	private questionTextarea: HTMLTextAreaElement | null = null;
	private answerTextarea: HTMLTextAreaElement | null = null;
	private saveButton: HTMLButtonElement | null = null;

	// Markdown rendering component
	private renderComponent: Component | null = null;

	// Autocomplete components
	private vaultSearchService: VaultSearchService | null = null;
	private questionSuggest: TextareaSuggest | null = null;
	private answerSuggest: TextareaSuggest | null = null;

	// Image service
	private imageService: ImageService | null = null;

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
		this.renderComponent = new Component();
		this.renderComponent.load();

		const folderFilter = this.options.autocompleteFolder ?? "";
		this.vaultSearchService = new VaultSearchService(this.app, folderFilter);
		this.vaultSearchService.buildIndex();

		this.imageService = new ImageService(this.app);

		// Now call super which will call renderBody()
		super.onOpen();
		this.contentEl.addClass("episteme-flashcard-editor-modal");
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

		// Question field with live preview
		this.renderLivePreviewField(
			container,
			"Question",
			card?.question || this.options.prefillQuestion || "",
			"question"
		);

		// Answer field with live preview
		this.renderLivePreviewField(
			container,
			"Answer",
			card?.answer || this.options.prefillAnswer || "",
			"answer"
		);

		// Smart toolbar
		this.renderSmartToolbar(container);

		// Buttons
		this.renderButtons(container);

		// Setup keyboard shortcuts
		this.setupKeyboardShortcuts(container);

		// Focus question textarea only if visible (empty field)
		// When editing with existing content, textarea is hidden and preview is shown
		const questionValue = card?.question || this.options.prefillQuestion || "";
		if (!questionValue.trim()) {
			setTimeout(() => this.questionTextarea?.focus(), 50);
		}
	}

	/**
	 * Render a single field with live preview (focus/blur behavior)
	 * On blur: shows rendered markdown
	 * On focus: shows raw markdown textarea
	 */
	private renderLivePreviewField(
		container: HTMLElement,
		label: string,
		initialValue: string,
		field: "question" | "answer"
	): void {
		const fieldGroup = container.createDiv({ cls: "episteme-live-field" });

		// Label
		fieldGroup.createEl("label", {
			text: label,
			cls: "episteme-form-label",
		});

		// Container for textarea/preview toggle
		const editorContainer = fieldGroup.createDiv({
			cls: "episteme-live-editor-container",
		});

		// Textarea (hidden by default if has content)
		const textarea = editorContainer.createEl("textarea", {
			cls: "episteme-live-textarea",
			attr: {
				"data-field": field,
				placeholder: field === "question"
					? "Type your question here..."
					: "Type your answer here...",
			},
		});
		textarea.value = initialValue;

		// Preview div
		const preview = editorContainer.createDiv({
			cls: "episteme-live-preview",
		});

		// Initial render
		if (initialValue.trim()) {
			this.renderPreview(preview, initialValue);
			textarea.addClass("hidden");
		} else {
			preview.addClass("hidden");
		}

		// Focus: show textarea, hide preview
		textarea.addEventListener("focus", () => {
			preview.addClass("hidden");
			textarea.removeClass("hidden");
		});

		// Blur: show preview, hide textarea (if has content)
		textarea.addEventListener("blur", () => {
			const value = textarea.value.trim();
			if (value) {
				this.renderPreview(preview, value);
				preview.removeClass("hidden");
				textarea.addClass("hidden");
			}
			this.validateForm();
		});

		// Click on preview: focus textarea
		preview.addEventListener("click", () => {
			textarea.removeClass("hidden");
			preview.addClass("hidden");
			textarea.focus();
		});

		// Input event for validation
		textarea.addEventListener("input", () => {
			this.validateForm();
		});

		// Keydown for field navigation
		textarea.addEventListener("keydown", (e) => {
			this.handleFieldKeydown(e, field);
		});

		// Paste handler for images
		textarea.addEventListener("paste", (e) => {
			void this.handleImagePaste(e, textarea);
		});

		// Store reference
		if (field === "question") {
			this.questionTextarea = textarea;
		} else {
			this.answerTextarea = textarea;
		}

		// Attach autocomplete suggest
		if (this.vaultSearchService) {
			const suggest = new TextareaSuggest(textarea, this.vaultSearchService);
			if (field === "question") {
				this.questionSuggest = suggest;
			} else {
				this.answerSuggest = suggest;
			}
		}
	}

	/**
	 * Render markdown preview into container
	 */
	private renderPreview(container: HTMLElement, markdown: string): void {
		container.empty();
		if (this.renderComponent) {
			MarkdownRenderer.render(
				this.app,
				markdown,
				container,
				this.options.currentFilePath,
				this.renderComponent
			);
		}
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
			{
				label: "Media",
				title: "Insert Image or Video (Ctrl+Shift+I)",
				insert: "media",
				shortcut: "Ctrl+Shift+I",
			},
		];

		for (const btn of buttons) {
			const btnEl = toolbar.createEl("button", {
				cls: "episteme-toolbar-btn",
				text: btn.label,
				attr: { title: btn.title },
			});

			// Prevent blur on textarea when clicking toolbar button
			btnEl.addEventListener("mousedown", (e) => {
				e.preventDefault();
			});

			btnEl.addEventListener("click", () => {
				if (btn.insert === "media") {
					void this.openMediaPicker();
				} else {
					this.insertFormatting(btn.insert);
				}
			});
		}

		// Help button
		const helpBtn = toolbar.createEl("button", {
			cls: "episteme-toolbar-btn episteme-help-btn",
			text: "?",
			attr: { title: "Show all keyboard shortcuts (Ctrl+/)" },
		});

		// Prevent blur on textarea when clicking help button
		helpBtn.addEventListener("mousedown", (e) => {
			e.preventDefault();
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

			// Ctrl+Shift+I for media picker
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "i") {
				e.preventDefault();
				void this.openMediaPicker();
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
			const activeElement = document.activeElement;
			const textarea = (activeElement === this.questionTextarea || activeElement === this.answerTextarea)
				? activeElement as HTMLTextAreaElement
				: this.questionTextarea;

			if (textarea) {
				this.insertAtCursor(textarea, result.markdown);
			}
		}
	}

	/**
	 * Insert text at cursor position in textarea
	 */
	private insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const value = textarea.value;

		textarea.value = value.substring(0, start) + text + value.substring(end);

		// Move cursor after inserted text
		const newPos = start + text.length;
		textarea.setSelectionRange(newPos, newPos);

		// Trigger input event to update validation
		textarea.dispatchEvent(new Event("input"));

		// Focus the textarea
		textarea.focus();
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
		// Clean up autocomplete components
		if (this.questionSuggest) {
			this.questionSuggest.destroy();
			this.questionSuggest = null;
		}
		if (this.answerSuggest) {
			this.answerSuggest.destroy();
			this.answerSuggest = null;
		}
		if (this.vaultSearchService) {
			this.vaultSearchService.clear();
			this.vaultSearchService = null;
		}

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

		const list = container.createDiv({ cls: "episteme-shortcuts-list" });

		for (const shortcut of shortcuts) {
			const item = list.createDiv({ cls: "episteme-shortcut-item" });

			item.createSpan({ cls: "episteme-shortcut-key", text: shortcut.key });
			item.createSpan({ cls: "episteme-shortcut-action", text: shortcut.action });
		}
	}
}
