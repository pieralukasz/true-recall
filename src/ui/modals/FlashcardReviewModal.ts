/**
 * Flashcard Review/Edit Modal
 * Allows reviewing and editing generated flashcards before saving
 */
import { App, Notice, MarkdownRenderer, Component } from "obsidian";
import { BaseModal } from "./BaseModal";
import type { FlashcardItem } from "../../types";
import type { OpenRouterService } from "../../services";
import {
	createEditableTextField,
	EditableTextField,
	TOOLBAR_BUTTONS,
} from "../components";

export interface FlashcardReviewResult {
	cancelled: boolean;
	flashcards?: FlashcardItem[];  // Final flashcards to save
}

export interface FlashcardReviewModalOptions {
	initialFlashcards: FlashcardItem[];
	sourceNoteName?: string;
	openRouterService: OpenRouterService;
}

/**
 * Edit mode state for a card field
 */
interface CardEditMode {
	index: number;
	field: "question" | "answer" | null;
	isEditing: boolean;
}

/**
 * Modal for reviewing and editing AI-generated flashcards
 */
export class FlashcardReviewModal extends BaseModal {
	private options: FlashcardReviewModalOptions;
	private resolvePromise: ((result: FlashcardReviewResult) => void) | null = null;
	private hasSelected = false;

	// Component for markdown rendering lifecycle
	private component: Component;

	// Services
	private openRouterService: OpenRouterService;

	// State
	private flashcards: FlashcardItem[];
	private deletedCardIds: Set<number> = new Set();
	private isRefining: boolean = false;
	private editingCard: CardEditMode | null = null;

	// UI refs
	private flashcardsListEl: HTMLElement | null = null;
	private instructionsInputEl: HTMLTextAreaElement | null = null;
	private refineButtonEl: HTMLButtonElement | null = null;
	private saveButtonEl: HTMLButtonElement | null = null;
	// Editable text field instance
	private editableField: EditableTextField | null = null;

	constructor(app: App, options: FlashcardReviewModalOptions) {
		super(app, {
			title: `Review Generated Flashcards (${options.initialFlashcards.length})`,
			width: "700px",
		});
		this.options = options;
		this.flashcards = [...options.initialFlashcards];  // Working copy
		this.component = new Component();
		this.openRouterService = options.openRouterService;
	}

	async openAndWait(): Promise<FlashcardReviewResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-review-flashcards-modal");
		this.component.load();
	}

	protected renderBody(container: HTMLElement): void {
		// AI Refine section (moved to top)
		this.renderRefineSection(container);

		// Flashcards list (scrollable)
		this.flashcardsListEl = container.createDiv({ cls: "episteme-review-flashcards-list" });
		this.renderFlashcardsList();

		// Action buttons
		this.renderActions(container);
	}

	// ===== Rendering methods =====

	private renderInfoSection(container: HTMLElement): void {
		const infoEl = container.createDiv({ cls: "episteme-review-info" });
		const sourceText = this.options.sourceNoteName
			? ` from "${this.options.sourceNoteName}"`
			: "";
		infoEl.createEl("p", {
			text: `Review the flashcards generated${sourceText}. You can edit questions and answers, delete cards, or use AI to refine them.`,
		});

		// Keyboard hint
		const hintEl = infoEl.createDiv({ cls: "episteme-review-hint" });
		hintEl.innerHTML = `<span class="episteme-key-hint">⌘ + click</span> to edit`;
	}

	private renderFlashcardsList(): void {
		if (!this.flashcardsListEl) return;

		this.flashcardsListEl.empty();

		const activeFlashcards = this.flashcards
			.map((_, i) => i)
			.filter(i => !this.deletedCardIds.has(i));

		if (activeFlashcards.length === 0) {
			this.flashcardsListEl.createDiv({
				cls: "episteme-review-empty",
				text: "No flashcards remaining. All cards have been deleted.",
			});
			this.updateButtons();
			return;
		}

		for (const index of activeFlashcards) {
			const card = this.flashcards[index];
			if (!card) continue;

			this.renderFlashcardItem(this.flashcardsListEl, card, index);
		}

		this.updateButtons();
	}

	private renderFlashcardItem(
		container: HTMLElement,
		card: FlashcardItem,
		index: number
	): void {
		const itemEl = container.createDiv({
			cls: "episteme-review-card-item",
		});

		// Check if this card/field is being edited
		const isEditing = this.editingCard?.index === index && this.editingCard?.isEditing && this.editingCard.field;

		if (isEditing && this.editingCard?.field) {
			this.renderEditMode(itemEl, card, index, this.editingCard.field);
		} else {
			this.renderViewMode(itemEl, card, index);
		}
	}

	private renderViewMode(
		itemEl: HTMLElement,
		card: FlashcardItem,
		index: number
	): void {
		// Content wrapper (takes remaining space)
		const contentEl = itemEl.createDiv({ cls: "episteme-review-card-content" });

		// Question field
		const questionEl = contentEl.createDiv({
			cls: "episteme-review-field episteme-review-field--view",
			attr: { "data-field": "question" },
		});
		questionEl.addEventListener("click", (e) => this.handleFieldClick(e, index, "question"));

		const questionContent = questionEl.createDiv({ cls: "episteme-md-content" });
		void MarkdownRenderer.renderMarkdown(
			card.question,
			questionContent,
			"",
			this.component
		);

		// Divider between question and answer
		contentEl.createEl("hr", { cls: "episteme-editor-divider" });

		// Answer field
		const answerEl = contentEl.createDiv({
			cls: "episteme-review-field episteme-review-field--view",
			attr: { "data-field": "answer" },
		});
		answerEl.addEventListener("click", (e) => this.handleFieldClick(e, index, "answer"));

		const answerContent = answerEl.createDiv({ cls: "episteme-md-content" });
		void MarkdownRenderer.renderMarkdown(
			card.answer,
			answerContent,
			"",
			this.component
		);

		// Delete button (on right side)
		const deleteBtn = itemEl.createEl("button", {
			cls: "episteme-review-delete-btn",
			attr: { "aria-label": "Delete flashcard", "title": "Delete" },
		});
		deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
		deleteBtn.addEventListener("click", () => this.deleteFlashcard(index));
	}

	private renderEditMode(
		itemEl: HTMLElement,
		card: FlashcardItem,
		index: number,
		field: "question" | "answer"
	): void {
		const content = field === "question" ? card.question : card.answer;

		// Use EditableTextField component with toolbar
		this.editableField = createEditableTextField(itemEl, {
			initialValue: content,
			showToolbar: true,
			toolbarButtons: TOOLBAR_BUTTONS.MINIMAL,
			toolbarPositioned: false,
			field,
			autoFocus: true,
			onSave: (value) => void this.saveEdit(index, field, value),
			onTab: () => {
				const nextField = field === "question" ? "answer" : "question";
				void (async () => {
					if (this.editableField) {
						await this.saveEdit(index, field, this.editableField.getValue());
					}
					this.startEdit(index, nextField);
				})();
			},
		});
	}

	private renderRefineSection(container: HTMLElement): void {
		const sectionEl = container.createDiv({
			cls: "episteme-review-refine-section",
		});

		sectionEl.createEl("h3", {
			text: "AI Refine (Optional)",
			cls: "episteme-review-section-title",
		});

		const instructionsContainer = sectionEl.createDiv({
			cls: "episteme-review-instructions-container",
		});

		this.instructionsInputEl = instructionsContainer.createEl("textarea", {
			placeholder: "e.g., 'Make questions more specific', 'Add examples', 'Simplify complex cards'...",
			cls: "episteme-review-instructions-input",
		});
		this.instructionsInputEl.rows = 2;

		const buttonContainer = sectionEl.createDiv({
			cls: "episteme-review-refine-buttons",
		});

		this.refineButtonEl = buttonContainer.createEl("button", {
			text: "Refine with AI",
			cls: "episteme-review-refine-btn",
		});
		this.refineButtonEl.addEventListener("click", () => void this.handleRefine());
	}

	private renderActions(container: HTMLElement): void {
		const actionsEl = container.createDiv({
			cls: "episteme-review-actions",
		});

		const buttonsContainer = actionsEl.createDiv({
			cls: "episteme-review-action-buttons",
		});

		this.saveButtonEl = buttonsContainer.createEl("button", {
			text: "Save flashcards",
			cls: "mod-cta episteme-review-save-btn",
		});
		this.saveButtonEl.addEventListener("click", () => this.handleSave());

		const cancelButton = buttonsContainer.createEl("button", {
			text: "Cancel",
			cls: "episteme-review-cancel-btn",
		});
		cancelButton.addEventListener("click", () => this.handleCancel());
	}

	// ===== State management =====

	private getActiveFlashcards(): FlashcardItem[] {
		return this.flashcards
			.map((card, index) => ({ card, index }))
			.filter(({ index }) => !this.deletedCardIds.has(index))
			.map(({ card }) => card);
	}

	private deleteFlashcard(index: number): void {
		this.deletedCardIds.add(index);
		this.updateTitle(`Review Generated Flashcards (${this.getActiveFlashcards().length})`);
		this.renderFlashcardsList();
	}

	private restoreFlashcard(index: number): void {
		this.deletedCardIds.delete(index);
		this.updateTitle(`Review Generated Flashcards (${this.getActiveFlashcards().length})`);
		this.renderFlashcardsList();
	}

	// ===== Click/Key handlers =====

	private handleFieldClick(
		e: MouseEvent,
		index: number,
		field: "question" | "answer"
	): void {
		// Cmd/Ctrl+click = edit mode
		if (e.metaKey || e.ctrlKey) {
			e.preventDefault();
			e.stopPropagation();
			this.startEdit(index, field);
		return;
	}

	// Handle internal links normally
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;
	const linkEl = target.closest("a.internal-link");
	if (!linkEl) return;

	if (linkEl) {
		const href = linkEl.getAttribute("data-href");
		if (href) {
			e.preventDefault();
			e.stopPropagation();
			void this.app.workspace.openLinkText(href, "", "tab");
		}
	}
	}

	private startEdit(index: number, field: "question" | "answer"): void {
		this.editingCard = { index, field, isEditing: true };
		this.renderFlashcardsList();
	}

	private async saveEdit(index: number, field: "question" | "answer", content: string): Promise<void> {
		if (!this.flashcards[index]) return;

		// Update flashcard
		if (field === "question") {
			this.flashcards[index].question = content;
		} else {
			this.flashcards[index].answer = content;
		}

		// Cleanup editable field
		this.editableField?.destroy();
		this.editableField = null;

		this.editingCard = null;
		this.renderFlashcardsList();
	}

	private getFinalFlashcards(): FlashcardItem[] {
		return this.flashcards
			.map((card, index) => ({ card, index }))
			.filter(({ index }) => !this.deletedCardIds.has(index))
			.map(({ card }) => card);
	}

	private updateButtons(): void {
		const activeCount = this.getActiveFlashcards().length;
		if (this.saveButtonEl) {
			this.saveButtonEl.disabled = activeCount === 0;
			this.saveButtonEl.textContent = activeCount === 0
				? "No cards to save"
				: `Save ${activeCount} Flashcard${activeCount !== 1 ? "s" : ""}`;
		}
	}

	// ===== AI Refine =====

	private async handleRefine(): Promise<void> {
		const instructions = this.instructionsInputEl?.value.trim();
		if (!instructions) {
			new Notice("Please enter refinement instructions");
			return;
		}

		const activeFlashcards = this.getActiveFlashcards();
		if (activeFlashcards.length === 0) {
			new Notice("No flashcards to refine");
			return;
		}

		this.isRefining = true;
		this.updateRefineButton();

		try {
			// Call refine method
			const refined = await this.openRouterService.refineFlashcards(
				activeFlashcards,
				instructions
			);

			// Replace all active (non-deleted) flashcards with the refined set
			// This allows adding/removing/splitting flashcards
			const activeIndices = this.flashcards
				.map((_, i) => i)
				.filter(i => !this.deletedCardIds.has(i));

			// Remove active flashcards (from end to beginning to preserve indices)
			for (const index of activeIndices.reverse()) {
				this.flashcards.splice(index, 1);
			}

			// Clear deleted set and add refined flashcards
			this.deletedCardIds.clear();
			this.flashcards.push(...refined);

			// Update title with new count
			this.updateTitle(`Review Generated Flashcards (${this.flashcards.length})`);

			// Re-render to show updated content
			this.renderFlashcardsList();
			this.updateButtons();

			const countChange = refined.length - activeFlashcards.length;
			const countMsg = countChange === 0
				? "Flashcards refined successfully"
				: countChange > 0
					? `Refined successfully: added ${countChange} flashcard${countChange !== 1 ? "s" : ""}`
					: `Refined successfully: removed ${Math.abs(countChange)} flashcard${Math.abs(countChange) !== 1 ? "s" : ""}`;
			new Notice(countMsg);
		} catch (error) {
			new Notice(`Refinement failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			this.isRefining = false;
			this.updateRefineButton();
		}
	}

	private updateRefineButton(): void {
		if (!this.refineButtonEl) return;

		if (this.isRefining) {
			this.refineButtonEl.disabled = true;
			this.refineButtonEl.textContent = "Refining...";
		} else {
			this.refineButtonEl.disabled = false;
			this.refineButtonEl.textContent = "Refine with AI";
		}
	}

	// ===== Actions =====

	private handleSave(): void {
		const finalFlashcards = this.getFinalFlashcards();
		if (finalFlashcards.length === 0) {
			new Notice("No flashcards to save");
			return;
		}

		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				flashcards: finalFlashcards,
			});
			this.resolvePromise = null;
		}
		this.close();
	}

	private handleCancel(): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({ cancelled: true });
			this.resolvePromise = null;
		}
		this.close();
	}

	onClose(): void {
		if (!this.hasSelected && this.resolvePromise) {
			this.resolvePromise({ cancelled: true });
			this.resolvePromise = null;
		}

		this.component.unload();

		const { contentEl } = this;
		contentEl.empty();
	}
}
