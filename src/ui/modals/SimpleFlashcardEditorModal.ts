/**
 * Simple Flashcard Editor Modal
 * Single textarea for writing flashcards in markdown format
 * Format: "Question #flashcard\nAnswer"
 */
import { App, Component, MarkdownRenderer } from "obsidian";
import { BaseModal } from "./BaseModal";
import { FlashcardParserService, notify, type OpenRouterService } from "../../services";
import type { FlashcardItem, TrueRecallSettings } from "../../types";
import { BATCH_IMPORT_PARSE_PROMPT, FLASHCARD_CONFIG } from "../../constants";
import { FlashcardReviewModal } from "./FlashcardReviewModal";

export interface SimpleFlashcardEditorResult {
	cancelled: boolean;
	flashcards: FlashcardItem[];
	/** For edit mode: the original card ID that was edited */
	editedCardId?: string;
}

export interface SimpleFlashcardEditorOptions {
	mode: "add" | "edit";
	/** Pre-fill content for the textarea */
	prefillContent?: string;
	/** For edit mode: ID of the card being edited */
	editCardId?: string;
	/** Current file path for context */
	currentFilePath: string;
	/** Optional: OpenRouter service for AI formatting */
	openRouterService?: OpenRouterService;
	/** Optional: Settings for AI formatting */
	settings?: TrueRecallSettings;
}

/**
 * Minimalist modal for writing flashcards in markdown format
 * - Single textarea with monospace font
 * - Keyboard shortcuts only (no toolbar)
 * - Format: "Question #flashcard\nAnswer"
 */
export class SimpleFlashcardEditorModal extends BaseModal {
	private options: SimpleFlashcardEditorOptions;
	private resolvePromise: ((result: SimpleFlashcardEditorResult) => void) | null = null;
	private hasSubmitted = false;

	private textarea: HTMLTextAreaElement | null = null;
	private saveButton: HTMLButtonElement | null = null;
	private saveWithAIButton: HTMLButtonElement | null = null;
	private parser: FlashcardParserService;

	// Preview mode state
	private isPreviewMode = false;
	private contentContainer: HTMLElement | null = null;
	private currentContent = "";
	private previewComponent: Component | null = null;

	// AI processing state
	private isProcessingAI = false;

	constructor(app: App, options: SimpleFlashcardEditorOptions) {
		super(app, {
			title: options.mode === "add" ? "Add Flashcards" : "Edit Flashcard",
			width: "600px",
		});
		this.options = options;
		this.parser = new FlashcardParserService();
	}

	/**
	 * Open modal and return promise with result
	 */
	async openAndWait(): Promise<SimpleFlashcardEditorResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-simple-flashcard-editor-modal");
	}

	protected renderBody(container: HTMLElement): void {
		// Hint text
		const hintEl = container.createDiv({
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:mb-3",
		});
		hintEl.createSpan({ text: "Format: " });
		hintEl.createEl("code", {
			text: `Question ${FLASHCARD_CONFIG.tag}`,
			cls: "ep:px-1 ep:py-0.5 ep:bg-obs-secondary ep:rounded ep:text-[10px]",
		});
		hintEl.createSpan({ text: " then answer on next line(s)" });

		// Content container (holds either textarea or preview)
		this.contentContainer = container.createDiv();

		// Initialize current content from prefill
		this.currentContent = this.options.prefillContent ?? "";

		// Render initial content (edit mode)
		this.renderEditMode();

		// Keyboard shortcuts hint
		const shortcutsHint = container.createDiv({
			cls: "ep:text-ui-smaller ep:text-obs-faint ep:mt-2 ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1",
		});
		const shortcuts = [
			{ key: "Ctrl+3", action: "#flashcard" },
			{ key: "Ctrl+B", action: "bold" },
			{ key: "Ctrl+I", action: "italic" },
			{ key: "Ctrl+K", action: "[[link]]" },
			{ key: "Ctrl+Enter", action: "save" },
		];
		for (const s of shortcuts) {
			const span = shortcutsHint.createSpan();
			span.createEl("kbd", {
				text: s.key,
				cls: "ep:px-1 ep:py-0.5 ep:bg-obs-secondary ep:rounded ep:text-[9px] ep:font-mono",
			});
			span.createSpan({ text: ` ${s.action}` });
		}

		// Buttons
		this.renderButtons(container);
	}

	/**
	 * Render the edit mode (textarea)
	 */
	private renderEditMode(): void {
		if (!this.contentContainer) return;

		// Clear container
		this.contentContainer.empty();

		// Textarea
		this.textarea = this.contentContainer.createEl("textarea", {
			cls: "simple-flashcard-editor-textarea",
			attr: {
				placeholder: `What is photosynthesis? ${FLASHCARD_CONFIG.tag}\nThe process by which plants convert light into energy\n\nWhat are the inputs? ${FLASHCARD_CONFIG.tag}\nSunlight, water, and CO2`,
				spellcheck: "true",
			},
		});

		// Set content
		this.textarea.value = this.currentContent;

		// Setup keyboard shortcuts
		this.setupKeyboardShortcuts();

		// Focus textarea
		setTimeout(() => {
			this.textarea?.focus();
			// Move cursor to end
			if (this.textarea) {
				this.textarea.selectionStart = this.textarea.value.length;
				this.textarea.selectionEnd = this.textarea.value.length;
			}
		}, 50);
	}

	/**
	 * Render the preview mode (rendered markdown)
	 */
	private async renderPreviewMode(): Promise<void> {
		if (!this.contentContainer) return;

		// Clear container
		this.contentContainer.empty();

		// Create preview container with same styling as textarea
		const previewEl = this.contentContainer.createDiv({
			cls: "simple-flashcard-editor-preview",
		});

		// If no content, show placeholder
		if (!this.currentContent.trim()) {
			previewEl.createDiv({
				text: "No content to preview",
				cls: "ep:text-obs-muted ep:italic",
			});
			return;
		}

		// Cleanup previous component
		if (this.previewComponent) {
			this.previewComponent.unload();
		}

		// Create component for markdown rendering lifecycle
		this.previewComponent = new Component();
		this.previewComponent.load();

		// Render markdown
		await MarkdownRenderer.render(
			this.app,
			this.currentContent,
			previewEl,
			this.options.currentFilePath,
			this.previewComponent
		);
	}

	/**
	 * Toggle between edit and preview modes
	 */
	private togglePreviewMode(): void {
		// Save current content before switching
		if (!this.isPreviewMode && this.textarea) {
			this.currentContent = this.textarea.value;
		}

		this.isPreviewMode = !this.isPreviewMode;

		if (this.isPreviewMode) {
			this.renderPreviewMode();
		} else {
			this.renderEditMode();
		}
	}

	/**
	 * Setup keyboard shortcuts for the textarea
	 */
	private setupKeyboardShortcuts(): void {
		if (!this.textarea) return;

		this.textarea.addEventListener("keydown", (e) => {
			const isMod = e.ctrlKey || e.metaKey;

			// Ctrl+3 or Ctrl+# - insert #flashcard tag
			// Note: # requires Shift+3, so we check for "3" with shift OR "#" directly
			if (isMod && (e.key === "3" || e.key === "#")) {
				e.preventDefault();
				this.insertFlashcardTag();
				return;
			}

			// Ctrl+B - bold
			if (isMod && e.key === "b") {
				e.preventDefault();
				this.wrapSelection("**", "**");
				return;
			}

			// Ctrl+I - italic
			if (isMod && e.key === "i") {
				e.preventDefault();
				this.wrapSelection("*", "*");
				return;
			}

			// Ctrl+K - wiki-link
			if (isMod && e.key === "k") {
				e.preventDefault();
				this.wrapSelection("[[", "]]");
				return;
			}

			// Ctrl+Enter - save
			if (isMod && e.key === "Enter") {
				e.preventDefault();
				this.handleSave();
				return;
			}

			// Escape - cancel (only when not in the middle of composition)
			if (e.key === "Escape" && !e.isComposing) {
				e.preventDefault();
				this.close();
				return;
			}
		});
	}

	/**
	 * Insert #flashcard tag at the end of current line
	 */
	private insertFlashcardTag(): void {
		if (!this.textarea) return;

		const pos = this.textarea.selectionStart;
		const text = this.textarea.value;

		// Find end of current line
		let lineEnd = text.indexOf("\n", pos);
		if (lineEnd === -1) lineEnd = text.length;

		// Check if line already has the tag
		const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
		const currentLine = text.slice(lineStart, lineEnd);
		if (currentLine.includes(FLASHCARD_CONFIG.tag)) {
			// Tag already exists, don't add another
			return;
		}

		// Insert " #flashcard" at end of line
		const tagText = ` ${FLASHCARD_CONFIG.tag}`;
		const before = text.slice(0, lineEnd);
		const after = text.slice(lineEnd);
		this.textarea.value = before + tagText + after;

		// Move cursor after the tag
		const newPos = lineEnd + tagText.length;
		this.textarea.selectionStart = newPos;
		this.textarea.selectionEnd = newPos;
		this.textarea.focus();
	}

	/**
	 * Wrap selected text with prefix and suffix
	 */
	private wrapSelection(prefix: string, suffix: string): void {
		if (!this.textarea) return;

		const start = this.textarea.selectionStart;
		const end = this.textarea.selectionEnd;
		const text = this.textarea.value;
		const selectedText = text.slice(start, end);

		// If no selection, just insert markers and place cursor between
		if (start === end) {
			const newText = text.slice(0, start) + prefix + suffix + text.slice(end);
			this.textarea.value = newText;
			const cursorPos = start + prefix.length;
			this.textarea.selectionStart = cursorPos;
			this.textarea.selectionEnd = cursorPos;
		} else {
			// Wrap selected text
			const newText = text.slice(0, start) + prefix + selectedText + suffix + text.slice(end);
			this.textarea.value = newText;
			// Select the wrapped text (including markers)
			this.textarea.selectionStart = start;
			this.textarea.selectionEnd = end + prefix.length + suffix.length;
		}

		this.textarea.focus();
	}

	/**
	 * Render action buttons
	 */
	private renderButtons(container: HTMLElement): void {
		const buttonsEl = container.createDiv({
			cls: "ep:flex ep:justify-between ep:items-center ep:gap-3 ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border",
		});

		// Left side: Preview toggle
		const leftEl = buttonsEl.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});
		const toggleLabel = leftEl.createEl("label", {
			cls: "ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-ui-smaller ep:text-obs-muted",
		});
		const toggle = toggleLabel.createEl("input", {
			type: "checkbox",
			cls: "ep:cursor-pointer",
		});
		toggle.checked = this.isPreviewMode;
		toggle.addEventListener("change", () => this.togglePreviewMode());
		toggleLabel.createSpan({ text: "Preview" });

		// Right side: Cancel + Save with AI + Save buttons
		const rightEl = buttonsEl.createDiv({
			cls: "ep:flex ep:gap-3",
		});

		const cancelBtn = rightEl.createEl("button", {
			text: "Cancel",
			cls: "ep:py-2.5 ep:px-5 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});
		cancelBtn.addEventListener("click", () => this.close());

		// Save with AI button (only if openRouterService is provided)
		if (this.options.openRouterService && this.options.settings) {
			this.saveWithAIButton = rightEl.createEl("button", {
				text: "Save with AI",
				cls: "ep:py-2.5 ep:px-5 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-modifier-hover",
			});
			this.saveWithAIButton.addEventListener("click", () => this.handleSaveWithAI());
		}

		const buttonText = this.options.mode === "add" ? "Save Flashcards" : "Save Changes";
		this.saveButton = rightEl.createEl("button", {
			text: buttonText,
			cls: "ep:py-2.5 ep:px-5 ep:bg-obs-interactive ep:text-white ep:border-none ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-interactive-hover",
		});
		this.saveButton.addEventListener("click", () => this.handleSave());
	}

	/**
	 * Handle save action
	 */
	private handleSave(): void {
		// Get content from textarea (if in edit mode) or from currentContent (if in preview mode)
		const content = this.isPreviewMode
			? this.currentContent.trim()
			: (this.textarea?.value ?? "").trim();

		if (!content) {
			notify().warning("Please enter some flashcard content");
			return;
		}

		// Parse flashcards from content
		const flashcards = this.parser.extractFlashcards(content);

		if (flashcards.length === 0) {
			notify().warning(`No flashcards found. Use "${FLASHCARD_CONFIG.tag}" tag after questions.`);
			return;
		}

		this.hasSubmitted = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				flashcards,
				editedCardId: this.options.editCardId,
			});
			this.resolvePromise = null;
		}
		this.close();
	}

	/**
	 * Handle save with AI formatting
	 */
	private async handleSaveWithAI(): Promise<void> {
		const { openRouterService, settings } = this.options;
		if (!openRouterService || !settings) {
			notify().error("AI service not available");
			return;
		}

		// Get content
		const content = this.isPreviewMode
			? this.currentContent.trim()
			: (this.textarea?.value ?? "").trim();

		if (!content) {
			notify().warning("Please enter some content to format");
			return;
		}

		// Prevent double-click
		if (this.isProcessingAI) return;
		this.isProcessingAI = true;

		// Update button state
		if (this.saveWithAIButton) {
			this.saveWithAIButton.disabled = true;
			this.saveWithAIButton.textContent = "Processing...";
		}

		try {
			// Send to AI for formatting
			const response = await openRouterService.generateFlashcards(
				content,
				undefined,
				BATCH_IMPORT_PARSE_PROMPT
			);

			// Parse AI response
			const flashcards = this.parser.extractFlashcards(response);

			if (flashcards.length === 0) {
				notify().warning("AI could not extract any flashcards from the content");
				return;
			}

			// Open review modal
			const reviewModal = new FlashcardReviewModal(this.app, {
				initialFlashcards: flashcards,
				sourceNoteName: this.options.currentFilePath,
				openRouterService,
				settings,
			});

			const reviewResult = await reviewModal.openAndWait();

			if (reviewResult.cancelled || !reviewResult.flashcards) {
				// User cancelled review - stay in editor
				return;
			}

			// User approved - return flashcards
			this.hasSubmitted = true;
			if (this.resolvePromise) {
				this.resolvePromise({
					cancelled: false,
					flashcards: reviewResult.flashcards,
					editedCardId: this.options.editCardId,
				});
				this.resolvePromise = null;
			}
			this.close();
		} catch (error) {
			notify().error(`AI formatting failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		} finally {
			this.isProcessingAI = false;
			if (this.saveWithAIButton) {
				this.saveWithAIButton.disabled = false;
				this.saveWithAIButton.textContent = "Save with AI";
			}
		}
	}

	onClose(): void {
		// Cleanup preview component
		if (this.previewComponent) {
			this.previewComponent.unload();
			this.previewComponent = null;
		}

		const { contentEl } = this;
		contentEl.empty();

		if (!this.hasSubmitted && this.resolvePromise) {
			this.resolvePromise({
				cancelled: true,
				flashcards: [],
			});
			this.resolvePromise = null;
		}
	}
}

/**
 * Helper to convert a flashcard to markdown format for editing
 */
export function flashcardToMarkdown(question: string, answer: string): string {
	return `${question} ${FLASHCARD_CONFIG.tag}\n${answer}`;
}
