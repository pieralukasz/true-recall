/**
 * Flashcard Review Modal
 * Allows reviewing and editing generated flashcards before saving
 * Redesigned with CompactCardItem-style interface
 */
import { App, Notice, Component } from "obsidian";
import { BaseModal } from "./BaseModal";
import type { FlashcardItem, GeneratedNoteType } from "../../types";
import type { OpenRouterService } from "../../services";
import { GENERATED_NOTE_TYPES } from "../../constants";
import { createModalCardItem, ModalCardItem } from "./components/ModalCardItem";
import { createExpandableAddCard, ExpandableAddCard } from "./components/ExpandableAddCard";

export interface FlashcardReviewResult {
	cancelled: boolean;
	flashcards?: FlashcardItem[];
	createNewNote?: boolean;
	noteType?: GeneratedNoteType;
	noteName?: string;
}

export interface FlashcardReviewModalOptions {
	initialFlashcards: FlashcardItem[];
	sourceNoteName?: string;
	openRouterService: OpenRouterService;
}

// Quick refine action presets
const REFINE_QUICK_ACTIONS = [
	{ label: "More specific", instruction: "Make questions more specific and focused" },
	{ label: "Add examples", instruction: "Add concrete examples to answers" },
	{ label: "Simplify", instruction: "Use simpler language, avoid jargon" },
	{ label: "Split complex", instruction: "Split complex cards into multiple simpler ones" },
];

/**
 * Modal state
 */
interface FlashcardReviewState {
	flashcards: FlashcardItem[];
	expandedCardIndex: number | null;
	editingCardIndex: number | null;
	editingField: "question" | "answer" | null;
	isAddCardExpanded: boolean;
	refineInstructions: string;
	isRefining: boolean;
	createNewNote: boolean;
	selectedNoteType: GeneratedNoteType;
	customNoteName: string;
	isSelectionMode: boolean;
	selectedCardIds: Set<string>;
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
	private state: FlashcardReviewState;

	// UI refs
	private flashcardsListEl: HTMLElement | null = null;
	private selectionToolbarEl: HTMLElement | null = null;
	private refineInputEl: HTMLTextAreaElement | null = null;
	private refineButtonEl: HTMLButtonElement | null = null;
	private saveButtonEl: HTMLButtonElement | null = null;
	private destinationOptionsEl: HTMLElement | null = null;
	private noteNameInputEl: HTMLInputElement | null = null;

	// Child components
	private cardComponents: ModalCardItem[] = [];
	private addCardComponent: ExpandableAddCard | null = null;

	constructor(app: App, options: FlashcardReviewModalOptions) {
		super(app, {
			title: `Review Flashcards (${options.initialFlashcards.length})`,
			width: "700px",
		});
		this.options = options;
		this.component = new Component();
		this.openRouterService = options.openRouterService;

		// Initialize state
		this.state = {
			flashcards: [...options.initialFlashcards],
			expandedCardIndex: null,
			editingCardIndex: null,
			editingField: null,
			isAddCardExpanded: false,
			refineInstructions: "",
			isRefining: false,
			createNewNote: false,
			selectedNoteType: "question",
			customNoteName: "",
			isSelectionMode: false,
			selectedCardIds: new Set(),
		};
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
		// AI Refine section
		this.renderRefineSection(container);

		// Selection toolbar (hidden by default)
		this.selectionToolbarEl = container.createDiv({
			cls: "ep:mb-2",
		});
		this.renderSelectionToolbar();

		// Flashcards list (scrollable)
		this.flashcardsListEl = container.createDiv({
			cls: "ep:max-h-[350px] ep:overflow-y-auto ep:mb-4 ep:pr-1",
		});
		this.renderFlashcardsList();

		// Destination section
		this.renderDestinationSection(container);

		// Action buttons
		this.renderActions(container);
	}

	// ===== Rendering methods =====

	private renderRefineSection(container: HTMLElement): void {
		const sectionEl = container.createDiv({
			cls: "ep:mb-3 ep:p-2 ep:bg-obs-secondary ep:rounded-md",
		});

		// Row 1: Quick action buttons
		const quickActionsRow = sectionEl.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2 ep:flex-wrap ep:mb-2",
		});

		for (const action of REFINE_QUICK_ACTIONS) {
			const btn = quickActionsRow.createEl("button", {
				text: action.label,
				cls: "ep:py-1 ep:px-2 ep:text-ui-smaller ep:bg-obs-primary ep:text-obs-muted ep:border ep:border-obs-border ep:rounded ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:hover:border-obs-interactive",
			});
			btn.addEventListener("click", () => {
				if (this.refineInputEl) {
					this.refineInputEl.value = action.instruction;
					this.state.refineInstructions = action.instruction;
					void this.handleRefine();
				}
			});
		}

		// Row 2: Input + Refine button
		const inputRow = sectionEl.createDiv({
			cls: "ep:flex ep:items-start ep:gap-2",
		});

		// Textarea (2 lines)
		this.refineInputEl = inputRow.createEl("textarea", {
			placeholder: "Custom instructions...",
			cls: "ep:flex-1 ep:min-w-32 ep:py-1.5 ep:px-2 ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:text-obs-normal ep:text-ui-smaller ep:focus:outline-none ep:focus:border-obs-interactive ep:resize-none",
		}) as HTMLTextAreaElement;
		this.refineInputEl.rows = 2;
		this.refineInputEl.addEventListener("input", () => {
			this.state.refineInstructions = this.refineInputEl?.value || "";
		});

		// Refine button
		this.refineButtonEl = inputRow.createEl("button", {
			text: "Refine",
			cls: "ep:py-1.5 ep:px-3 ep:text-ui-smaller ep:bg-obs-interactive ep:text-white ep:border-none ep:rounded ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-interactive-hover ep:disabled:opacity-50 ep:disabled:cursor-not-allowed",
		});
		this.refineButtonEl.addEventListener("click", () => void this.handleRefine());
	}

	private renderSelectionToolbar(): void {
		if (!this.selectionToolbarEl) return;
		this.selectionToolbarEl.empty();

		const { isSelectionMode, selectedCardIds, flashcards } = this.state;

		// Only show toolbar when in selection mode (long-press to enter)
		if (!isSelectionMode) {
			return;
		}

		{
			// Show selection mode toolbar
			const toolbarRow = this.selectionToolbarEl.createDiv({
				cls: "ep:flex ep:items-center ep:justify-between ep:gap-2 ep:p-2 ep:bg-obs-secondary ep:rounded-md",
			});

			// Left side: count and select all
			const leftSide = toolbarRow.createDiv({
				cls: "ep:flex ep:items-center ep:gap-2",
			});

			const allSelected = selectedCardIds.size === flashcards.length && flashcards.length > 0;
			const selectAllBtn = leftSide.createEl("button", {
				text: allSelected ? "Deselect all" : "Select all",
				cls: "ep:py-1 ep:px-2 ep:text-ui-smaller ep:bg-obs-primary ep:text-obs-muted ep:border ep:border-obs-border ep:rounded ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
			});
			selectAllBtn.addEventListener("click", () => this.handleToggleSelectAll());

			const countEl = leftSide.createSpan({
				text: `${selectedCardIds.size} selected`,
				cls: "ep:text-ui-smaller ep:text-obs-muted",
			});

			// Right side: actions
			const rightSide = toolbarRow.createDiv({
				cls: "ep:flex ep:items-center ep:gap-2",
			});

			const deleteBtn = rightSide.createEl("button", {
				text: "Delete selected",
				cls: "ep:py-1 ep:px-2 ep:text-ui-smaller ep:bg-red-500/10 ep:text-red-500 ep:border ep:border-red-500/30 ep:rounded ep:cursor-pointer ep:transition-colors ep:hover:bg-red-500/20 ep:disabled:opacity-50 ep:disabled:cursor-not-allowed",
			});
			deleteBtn.disabled = selectedCardIds.size === 0;
			deleteBtn.addEventListener("click", () => this.handleDeleteSelected());

			const cancelBtn = rightSide.createEl("button", {
				text: "Cancel",
				cls: "ep:py-1 ep:px-2 ep:text-ui-smaller ep:bg-obs-primary ep:text-obs-muted ep:border ep:border-obs-border ep:rounded ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover",
			});
			cancelBtn.addEventListener("click", () => this.handleExitSelectionMode());
		}
	}

	private renderFlashcardsList(): void {
		if (!this.flashcardsListEl) return;

		// Cleanup existing components
		this.cardComponents.forEach((c) => c.destroy());
		this.cardComponents = [];
		this.addCardComponent?.destroy();
		this.addCardComponent = null;

		this.flashcardsListEl.empty();

		const { flashcards, expandedCardIndex, editingCardIndex, editingField } = this.state;

		if (flashcards.length === 0) {
			this.flashcardsListEl.createDiv({
				cls: "ep:text-center ep:text-obs-muted ep:py-6 ep:px-4 ep:italic",
				text: "No flashcards. Add one below or use AI to generate.",
			});
		} else {
			for (let i = 0; i < flashcards.length; i++) {
				const card = flashcards[i];
				if (!card) continue;

				const cardWrapper = this.flashcardsListEl.createDiv();
				const cardComponent = createModalCardItem(cardWrapper, {
					card,
					index: i,
					app: this.app,
					component: this.component,
					isExpanded: expandedCardIndex === i,
					isEditing: editingCardIndex === i,
					editingField: editingCardIndex === i ? editingField : null,
					isSelectionMode: this.state.isSelectionMode,
					isSelected: card.id ? this.state.selectedCardIds.has(card.id) : false,
					onToggleExpand: () => this.handleToggleExpand(i),
					onStartEdit: (field) => this.handleStartEdit(i, field),
					onSaveEdit: (question, answer) => this.handleSaveEdit(i, question, answer),
					onCancelEdit: () => this.handleCancelEdit(),
					onDelete: () => this.handleDeleteCard(i),
					onToggleSelect: () => this.handleToggleSelect(i),
					onEnterSelectionMode: () => this.handleEnterSelectionMode(i),
				});
				this.cardComponents.push(cardComponent);
			}
		}

		// Add card component
		const addCardWrapper = this.flashcardsListEl.createDiv();
		this.addCardComponent = createExpandableAddCard(addCardWrapper, {
			isExpanded: this.state.isAddCardExpanded,
			onToggleExpand: () => this.handleToggleAddCard(),
			onSave: (question, answer) => this.handleAddCard(question, answer),
			onCancel: () => this.handleCancelAddCard(),
		});

		this.updateButtons();
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
		checkbox.checked = this.state.createNewNote;

		const label = checkboxRow.createEl("label", {
			text: "Create new note for these flashcards",
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal ep:cursor-pointer",
		});
		label.htmlFor = "episteme-create-new-note";

		// Options container (hidden by default)
		this.destinationOptionsEl = sectionEl.createDiv({
			cls: "ep:mt-3 ep:pt-3 ep:border-t ep:border-obs-border",
		});
		this.destinationOptionsEl.style.display = this.state.createNewNote ? "block" : "none";

		// Note type radio buttons
		this.destinationOptionsEl.createDiv({
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
			const isSelected = this.state.selectedNoteType === typeKey;
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
			radio.checked = isSelected;

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
					this.state.selectedNoteType = typeKey;
					this.updateSuggestedNoteName();
					radioGroup.querySelectorAll("[data-type]").forEach((el) => {
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
		this.noteNameInputEl.value = this.state.customNoteName;
		this.noteNameInputEl.addEventListener("input", () => {
			this.state.customNoteName = this.noteNameInputEl?.value || "";
		});

		// Toggle visibility on checkbox change
		checkbox.addEventListener("change", () => {
			this.state.createNewNote = checkbox.checked;
			if (this.destinationOptionsEl) {
				this.destinationOptionsEl.style.display = this.state.createNewNote ? "block" : "none";
			}
			if (this.state.createNewNote) {
				this.updateSuggestedNoteName();
			}
		});
	}

	private updateSuggestedNoteName(): void {
		if (!this.noteNameInputEl || this.state.customNoteName) return;

		const firstCard = this.state.flashcards[0];
		if (firstCard) {
			const config = GENERATED_NOTE_TYPES[this.state.selectedNoteType];
			const firstQuestion = firstCard.question
				.replace(/\*\*/g, "")
				.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1")
				.replace(/#flashcard/g, "")
				.replace(/<br\s*\/?>/gi, " ")
				.trim()
				.substring(0, 50);
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

		const cancelButton = buttonsContainer.createEl("button", {
			text: "Cancel",
			cls: "ep:py-2.5 ep:px-5 ep:text-ui-small ep:font-medium ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});
		cancelButton.addEventListener("click", () => this.handleCancel());

		this.saveButtonEl = buttonsContainer.createEl("button", {
			text: "Save flashcards",
			cls: "mod-cta ep:py-2.5 ep:px-5 ep:text-ui-small ep:font-medium",
		});
		this.saveButtonEl.addEventListener("click", () => this.handleSave());
	}

	// ===== State handlers =====

	private handleToggleExpand(index: number): void {
		if (this.state.expandedCardIndex === index) {
			this.state.expandedCardIndex = null;
		} else {
			this.state.expandedCardIndex = index;
		}
		// Close editing if we're collapsing
		if (this.state.editingCardIndex === index && this.state.expandedCardIndex === null) {
			this.state.editingCardIndex = null;
			this.state.editingField = null;
		}
		this.renderFlashcardsList();
	}

	private handleStartEdit(index: number, field: "question" | "answer"): void {
		this.state.expandedCardIndex = index;
		this.state.editingCardIndex = index;
		this.state.editingField = field;
		this.renderFlashcardsList();
	}

	private handleSaveEdit(index: number, question: string, answer: string): void {
		const card = this.state.flashcards[index];
		if (card) {
			card.question = question;
			card.answer = answer;
		}
		this.state.editingCardIndex = null;
		this.state.editingField = null;
		this.renderFlashcardsList();
	}

	private handleCancelEdit(): void {
		this.state.editingCardIndex = null;
		this.state.editingField = null;
		this.renderFlashcardsList();
	}

	private handleDeleteCard(index: number): void {
		this.state.flashcards.splice(index, 1);
		// Adjust expanded/editing indices
		if (this.state.expandedCardIndex === index) {
			this.state.expandedCardIndex = null;
		} else if (this.state.expandedCardIndex !== null && this.state.expandedCardIndex > index) {
			this.state.expandedCardIndex--;
		}
		if (this.state.editingCardIndex === index) {
			this.state.editingCardIndex = null;
			this.state.editingField = null;
		} else if (this.state.editingCardIndex !== null && this.state.editingCardIndex > index) {
			this.state.editingCardIndex--;
		}
		this.updateTitle(`Review Flashcards (${this.state.flashcards.length})`);
		this.renderFlashcardsList();
	}

	private handleToggleAddCard(): void {
		this.state.isAddCardExpanded = !this.state.isAddCardExpanded;
		this.renderFlashcardsList();
	}

	private handleAddCard(question: string, answer: string): void {
		const newCard: FlashcardItem = {
			id: crypto.randomUUID(),
			question,
			answer,
		};
		this.state.flashcards.push(newCard);
		this.state.isAddCardExpanded = false;
		this.updateTitle(`Review Flashcards (${this.state.flashcards.length})`);
		this.renderFlashcardsList();
		new Notice("Flashcard added");
	}

	private handleCancelAddCard(): void {
		this.state.isAddCardExpanded = false;
		this.renderFlashcardsList();
	}

	// ===== Selection mode handlers =====

	private handleEnterSelectionMode(index?: number): void {
		this.state.isSelectionMode = true;
		this.state.selectedCardIds = new Set();
		// If index provided, select that card
		if (index !== undefined) {
			const card = this.state.flashcards[index];
			if (card?.id) {
				this.state.selectedCardIds.add(card.id);
			}
		}
		// Collapse any expanded cards
		this.state.expandedCardIndex = null;
		this.state.editingCardIndex = null;
		this.state.editingField = null;
		this.renderSelectionToolbar();
		this.renderFlashcardsList();
	}

	private handleExitSelectionMode(): void {
		this.state.isSelectionMode = false;
		this.state.selectedCardIds = new Set();
		this.renderSelectionToolbar();
		this.renderFlashcardsList();
	}

	private handleToggleSelect(index: number): void {
		const card = this.state.flashcards[index];
		if (!card?.id) return;

		if (this.state.selectedCardIds.has(card.id)) {
			this.state.selectedCardIds.delete(card.id);
		} else {
			this.state.selectedCardIds.add(card.id);
		}
		this.renderSelectionToolbar();
		this.renderFlashcardsList();
	}

	private handleToggleSelectAll(): void {
		const allSelected = this.state.selectedCardIds.size === this.state.flashcards.length;
		if (allSelected) {
			this.state.selectedCardIds = new Set();
		} else {
			this.state.selectedCardIds = new Set(
				this.state.flashcards.map((c) => c.id).filter((id): id is string => !!id)
			);
		}
		this.renderSelectionToolbar();
		this.renderFlashcardsList();
	}

	private handleDeleteSelected(): void {
		const selectedCount = this.state.selectedCardIds.size;
		if (selectedCount === 0) return;

		// Remove selected cards
		this.state.flashcards = this.state.flashcards.filter(
			(card) => !card.id || !this.state.selectedCardIds.has(card.id)
		);

		// Exit selection mode
		this.state.isSelectionMode = false;
		this.state.selectedCardIds = new Set();

		// Update title and re-render
		this.updateTitle(`Review Flashcards (${this.state.flashcards.length})`);
		this.renderSelectionToolbar();
		this.renderFlashcardsList();

		new Notice(`Deleted ${selectedCount} flashcard${selectedCount !== 1 ? "s" : ""}`);
	}

	private updateButtons(): void {
		const count = this.state.flashcards.length;
		if (this.saveButtonEl) {
			this.saveButtonEl.disabled = count === 0;
			this.saveButtonEl.textContent = count === 0
				? "No cards to save"
				: `Save ${count} flashcard${count !== 1 ? "s" : ""}`;
		}
	}

	// ===== AI Refine =====

	private async handleRefine(): Promise<void> {
		const instructions = this.state.refineInstructions.trim();
		if (!instructions) {
			new Notice("Please enter refinement instructions or select a quick action");
			return;
		}

		if (this.state.flashcards.length === 0) {
			new Notice("No flashcards to refine");
			return;
		}

		this.state.isRefining = true;
		this.updateRefineButton();

		try {
			const refined = await this.openRouterService.refineFlashcards(
				this.state.flashcards,
				instructions
			);

			// Replace flashcards with refined version
			this.state.flashcards = refined;
			this.state.expandedCardIndex = null;
			this.state.editingCardIndex = null;
			this.state.editingField = null;

			this.updateTitle(`Review Flashcards (${this.state.flashcards.length})`);
			this.renderFlashcardsList();

			new Notice(`Flashcards refined (${refined.length} cards)`);
		} catch (error) {
			new Notice(`Refinement failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			this.state.isRefining = false;
			this.updateRefineButton();
		}
	}

	private updateRefineButton(): void {
		if (!this.refineButtonEl) return;

		if (this.state.isRefining) {
			this.refineButtonEl.disabled = true;
			this.refineButtonEl.textContent = "Refining...";
		} else {
			this.refineButtonEl.disabled = false;
			this.refineButtonEl.textContent = "Refine with AI";
		}
	}

	// ===== Actions =====

	private handleSave(): void {
		if (this.state.flashcards.length === 0) {
			new Notice("No flashcards to save");
			return;
		}

		this.hasSelected = true;
		if (this.resolvePromise) {
			const result: FlashcardReviewResult = {
				cancelled: false,
				flashcards: this.state.flashcards,
			};

			if (this.state.createNewNote) {
				result.createNewNote = true;
				result.noteType = this.state.selectedNoteType;
				if (this.state.customNoteName.trim()) {
					result.noteName = this.state.customNoteName.trim();
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

		// Cleanup components
		this.cardComponents.forEach((c) => c.destroy());
		this.cardComponents = [];
		this.addCardComponent?.destroy();
		this.addCardComponent = null;

		this.component.unload();
		this.contentEl.empty();
	}
}
