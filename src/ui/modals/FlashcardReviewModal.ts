/**
 * Flashcard Review Modal
 * Allows reviewing and editing generated flashcards before saving
 * Redesigned with CompactCardItem-style interface
 */
import { App, Component } from "obsidian";
import { BaseModal } from "./BaseModal";
import type { FlashcardItem, TrueRecallSettings } from "../../types";
import { notify, type OpenRouterService } from "../../services";
import { createModalCardItem, ModalCardItem } from "./components/ModalCardItem";
import { SECONDARY_BUTTON_CLASSES } from "../utils/tailwind";

export interface FlashcardReviewResult {
	cancelled: boolean;
	flashcards?: FlashcardItem[];
}

export interface FlashcardReviewModalOptions {
	initialFlashcards: FlashcardItem[];
	sourceNoteName?: string;
	openRouterService: OpenRouterService;
	settings: TrueRecallSettings;
}

interface FlashcardReviewState {
	flashcards: FlashcardItem[];
	expandedCardIndex: number | null;
	editingCardIndex: number | null;
	editingField: "question" | "answer" | null;
	isSelectionMode: boolean;
	selectedCardIds: Set<string>;
}

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
	private saveButtonEl: HTMLButtonElement | null = null;

	// Child components
	private cardComponents: ModalCardItem[] = [];

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
		this.contentEl.addClass("true-recall-review-flashcards-modal");
		this.component.load();
	}

	protected renderBody(container: HTMLElement): void {
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

		// Action buttons
		this.renderActions(container);
	}

	// ===== Rendering methods =====

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

			leftSide.createSpan({
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

		this.flashcardsListEl.empty();

		const { flashcards, expandedCardIndex, editingCardIndex, editingField } = this.state;

		if (flashcards.length === 0) {
			this.flashcardsListEl.createDiv({
				cls: "ep:text-center ep:text-obs-muted ep:py-6 ep:px-4 ep:italic",
				text: "No flashcards to review.",
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

		this.updateButtons();
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
			cls: SECONDARY_BUTTON_CLASSES,
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

		notify().cardsDeleted(selectedCount);
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

	// ===== Actions =====

	private handleSave(): void {
		if (this.state.flashcards.length === 0) {
			notify().warning("No flashcards to save");
			return;
		}

		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise({
				cancelled: false,
				flashcards: this.state.flashcards,
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

		// Cleanup components
		this.cardComponents.forEach((c) => c.destroy());
		this.cardComponents = [];

		this.component.unload();
		this.contentEl.empty();
	}
}
