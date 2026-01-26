/**
 * Flashcard Review/Edit Modal
 * Allows reviewing and editing generated flashcards before saving
 */
import { App, Notice, MarkdownRenderer, Component } from "obsidian";
import { BaseModal } from "./BaseModal";
import type { FlashcardItem, GeneratedNoteType } from "../../types";
import type { OpenRouterService } from "../../services";
import {
	createEditableTextField,
	EditableTextField,
	TOOLBAR_BUTTONS,
} from "../components";
import { GENERATED_NOTE_TYPES } from "../../constants";

export interface FlashcardReviewResult {
	cancelled: boolean;
	flashcards?: FlashcardItem[];  // Final flashcards to save
	// Options for creating a new note as destination
	createNewNote?: boolean;
	noteType?: GeneratedNoteType;
	noteName?: string;
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

	// Destination state (for creating new note)
	private createNewNote: boolean = false;
	private selectedNoteType: GeneratedNoteType = "question";
	private customNoteName: string = "";

	// UI refs
	private flashcardsListEl: HTMLElement | null = null;
	private instructionsInputEl: HTMLTextAreaElement | null = null;
	private refineButtonEl: HTMLButtonElement | null = null;
	private saveButtonEl: HTMLButtonElement | null = null;
	private destinationOptionsEl: HTMLElement | null = null;
	private noteNameInputEl: HTMLInputElement | null = null;
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

		// Destination section (create new note option)
		this.renderDestinationSection(container);

		// Flashcards list (scrollable)
		this.flashcardsListEl = container.createDiv({ cls: "ep:max-h-[400px] ep:overflow-y-auto ep:mb-4 ep:pr-2" });
		this.renderFlashcardsList();

		// Action buttons
		this.renderActions(container);
	}

	// ===== Rendering methods =====

	private renderInfoSection(container: HTMLElement): void {
		const infoEl = container.createDiv({ cls: "ep:text-obs-muted ep:text-ui-small ep:mb-4 ep:p-3 ep:bg-obs-secondary ep:rounded-md" });
		const sourceText = this.options.sourceNoteName
			? ` from "${this.options.sourceNoteName}"`
			: "";
		infoEl.createEl("p", {
			text: `Review the flashcards generated${sourceText}. You can edit questions and answers, delete cards, or use AI to refine them.`,
		});

		// Keyboard hint
		const hintEl = infoEl.createDiv({ cls: "ep:text-ui-smaller ep:text-obs-muted ep:text-center ep:mt-1" });
		hintEl.innerHTML = `<span class="ep:inline-block ep:py-0.5 ep:px-1.5 ep:bg-obs-border ep:rounded ep:font-mono ep:text-[10px]">⌘ + click</span> to edit`;
	}

	private renderFlashcardsList(): void {
		if (!this.flashcardsListEl) return;

		this.flashcardsListEl.empty();

		const activeFlashcards = this.flashcards
			.map((_, i) => i)
			.filter(i => !this.deletedCardIds.has(i));

		if (activeFlashcards.length === 0) {
			this.flashcardsListEl.createDiv({
				cls: "ep:text-center ep:text-obs-muted ep:py-6 ep:px-4 ep:italic",
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
			cls: "ep:flex ep:flex-col ep:gap-3 ep:mb-3 ep:p-3 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md ep:transition-colors ep:hover:border-obs-interactive",
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
		const contentEl = itemEl.createDiv({ cls: "ep:flex-1 ep:min-w-0" });

		// Question field
		const questionEl = contentEl.createDiv({
			cls: "ep:relative ep:cursor-pointer ep:p-2 ep:rounded ep:transition-colors ep:hover:bg-obs-modifier-hover",
			attr: { "data-field": "question" },
		});
		questionEl.addEventListener("click", (e) => this.handleFieldClick(e, index, "question"));

		const questionContent = questionEl.createDiv({ cls: "ep:text-ui-small ep:leading-normal" });
		void MarkdownRenderer.renderMarkdown(
			card.question,
			questionContent,
			"",
			this.component
		);

		// Divider between question and answer
		contentEl.createEl("hr", { cls: "ep:border-none ep:border-t ep:border-obs-border ep:my-3" });

		// Answer field
		const answerEl = contentEl.createDiv({
			cls: "ep:relative ep:cursor-pointer ep:p-2 ep:rounded ep:transition-colors ep:hover:bg-obs-modifier-hover",
			attr: { "data-field": "answer" },
		});
		answerEl.addEventListener("click", (e) => this.handleFieldClick(e, index, "answer"));

		const answerContent = answerEl.createDiv({ cls: "ep:text-ui-small ep:leading-normal" });
		void MarkdownRenderer.renderMarkdown(
			card.answer,
			answerContent,
			"",
			this.component
		);

		// Delete button (on right side)
		const deleteBtn = itemEl.createEl("button", {
			cls: "ep:w-7 ep:h-7 ep:p-1.5 ep:bg-transparent ep:text-obs-muted ep:border-none ep:rounded ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:text-red-500 ep:self-end",
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
			cls: "ep:mb-3 ep:p-3 ep:bg-obs-secondary ep:rounded-md",
		});

		sectionEl.createEl("h3", {
			text: "AI Refine (Optional)",
			cls: "ep:text-ui-small ep:font-semibold ep:m-0 ep:mb-2 ep:text-obs-normal",
		});

		const instructionsContainer = sectionEl.createDiv({
			cls: "ep:mb-2",
		});

		this.instructionsInputEl = instructionsContainer.createEl("textarea", {
			placeholder: "e.g., 'Make questions more specific', 'Add examples', 'Simplify complex cards'...",
			cls: "ep:w-full ep:p-2 ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:resize-none ep:focus:outline-none ep:focus:border-obs-interactive",
		});
		this.instructionsInputEl.rows = 2;

		const buttonContainer = sectionEl.createDiv({
			cls: "ep:flex ep:justify-end",
		});

		this.refineButtonEl = buttonContainer.createEl("button", {
			text: "Refine with AI",
			cls: "ep:py-1.5 ep:px-4 ep:text-ui-small ep:bg-obs-interactive ep:text-white ep:border-none ep:rounded ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-interactive-hover ep:disabled:opacity-50 ep:disabled:cursor-not-allowed",
		});
		this.refineButtonEl.addEventListener("click", () => void this.handleRefine());
	}

	private renderDestinationSection(container: HTMLElement): void {
		const sectionEl = container.createDiv({
			cls: "ep:mb-3 ep:p-3 ep:bg-obs-secondary ep:rounded-md",
		});

		// Checkbox row
		const checkboxRow = sectionEl.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});

		const checkbox = checkboxRow.createEl("input", {
			type: "checkbox",
			cls: "ep:w-4 ep:h-4 ep:accent-obs-interactive ep:cursor-pointer",
		});
		checkbox.id = "episteme-create-new-note";
		checkbox.checked = this.createNewNote;

		const label = checkboxRow.createEl("label", {
			text: "Create new note for these flashcards",
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal ep:cursor-pointer",
		});
		label.htmlFor = "episteme-create-new-note";

		// Options container (hidden by default)
		this.destinationOptionsEl = sectionEl.createDiv({
			cls: "ep:mt-3 ep:pt-3 ep:border-t ep:border-obs-border",
		});
		this.destinationOptionsEl.style.display = this.createNewNote ? "block" : "none";

		// Note type radio buttons
		const typeLabel = this.destinationOptionsEl.createDiv({
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-muted ep:mb-2",
			text: "Note type:",
		});

		const radioGroup = this.destinationOptionsEl.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-1.5 ep:mb-3",
		});

		const baseItemCls = "ep:flex ep:items-start ep:gap-2 ep:py-2 ep:px-2.5 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:cursor-pointer ep:transition-colors ep:hover:border-obs-interactive";
		const selectedItemCls = "ep:border-obs-interactive ep:bg-obs-interactive/10";

		for (const [key, config] of Object.entries(GENERATED_NOTE_TYPES)) {
			const typeKey = key as GeneratedNoteType;
			const isSelected = this.selectedNoteType === typeKey;
			const radioItem = radioGroup.createDiv({
				cls: `${baseItemCls}${isSelected ? ` ${selectedItemCls}` : ""}`,
				attr: { "data-type": typeKey },
			});

			const radio = radioItem.createEl("input", {
				type: "radio",
				cls: "ep:w-4 ep:h-4 ep:mt-0.5 ep:accent-obs-interactive ep:cursor-pointer",
			});
			radio.name = "note-type";
			radio.value = typeKey;
			radio.id = `episteme-note-type-${typeKey}`;
			radio.checked = this.selectedNoteType === typeKey;

			const radioLabel = radioItem.createEl("label", {
				cls: "ep:flex ep:flex-col ep:gap-0.5 ep:cursor-pointer ep:flex-1",
			});
			radioLabel.htmlFor = `episteme-note-type-${typeKey}`;

			radioLabel.createEl("span", {
				text: config.label,
				cls: "ep:text-ui-small ep:font-semibold ep:text-obs-normal",
			});
			radioLabel.createEl("span", {
				text: config.description,
				cls: "ep:text-ui-smaller ep:text-obs-muted",
			});

			radio.addEventListener("change", () => {
				if (radio.checked) {
					this.selectedNoteType = typeKey;
					this.updateSuggestedNoteName();
					// Update visual selection
					radioGroup.querySelectorAll("[data-type]").forEach(el => {
						el.classList.remove(...selectedItemCls.split(" "));
					});
					radioItem.classList.add(...selectedItemCls.split(" "));
				}
			});
		}

		// Note name input
		const nameContainer = this.destinationOptionsEl.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-1.5",
		});

		nameContainer.createEl("label", {
			text: "Note name (optional):",
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-muted",
		});

		this.noteNameInputEl = nameContainer.createEl("input", {
			type: "text",
			cls: "ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:placeholder:text-sm",
			placeholder: "Leave empty for auto-generated name",
		});
		this.noteNameInputEl.value = this.customNoteName;

		this.noteNameInputEl.addEventListener("input", () => {
			this.customNoteName = this.noteNameInputEl?.value || "";
		});

		// Toggle visibility on checkbox change
		checkbox.addEventListener("change", () => {
			this.createNewNote = checkbox.checked;
			if (this.destinationOptionsEl) {
				this.destinationOptionsEl.style.display = this.createNewNote ? "block" : "none";
			}
			if (this.createNewNote) {
				this.updateSuggestedNoteName();
			}
		});
	}

	private updateSuggestedNoteName(): void {
		if (!this.noteNameInputEl || this.customNoteName) return;

		// Auto-suggest name based on first flashcard question
		const activeFlashcards = this.getActiveFlashcards();
		const firstCard = activeFlashcards[0];
		if (firstCard) {
			const config = GENERATED_NOTE_TYPES[this.selectedNoteType];
			const firstQuestion = firstCard.question
				.replace(/\*\*/g, "")  // Remove bold markers
				.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1")  // Remove backlink syntax
				.replace(/#flashcard/g, "")  // Remove flashcard tag
				.trim()
				.substring(0, 50);  // Limit length
			this.noteNameInputEl.placeholder = `${config.defaultNamePrefix}${firstQuestion}...`;
		}
	}

	private renderActions(container: HTMLElement): void {
		const actionsEl = container.createDiv({
			cls: "ep:pt-4 ep:border-t ep:border-obs-border",
		});

		const buttonsContainer = actionsEl.createDiv({
			cls: "ep:flex ep:justify-end ep:gap-3",
		});

		this.saveButtonEl = buttonsContainer.createEl("button", {
			text: "Save flashcards",
			cls: "mod-cta ep:py-2.5 ep:px-5 ep:text-ui-small ep:font-medium",
		});
		this.saveButtonEl.addEventListener("click", () => this.handleSave());

		const cancelButton = buttonsContainer.createEl("button", {
			text: "Cancel",
			cls: "ep:py-2.5 ep:px-5 ep:text-ui-small ep:font-medium ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover",
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
			const result: FlashcardReviewResult = {
				cancelled: false,
				flashcards: finalFlashcards,
			};

			// Include destination options if creating new note
			if (this.createNewNote) {
				result.createNewNote = true;
				result.noteType = this.selectedNoteType;
				// Use custom name if provided, otherwise leave undefined for auto-generation
				if (this.customNoteName.trim()) {
					result.noteName = this.customNoteName.trim();
				}
			}

			this.resolvePromise(result);
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
