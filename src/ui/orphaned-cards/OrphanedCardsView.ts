/**
 * Orphaned Cards View
 * Panel-based view for managing flashcards without source notes
 */
import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { VIEW_TYPE_ORPHANED_CARDS } from "../../constants";
import { createOrphanedCardsStateManager } from "../../state/orphaned-cards.state";
import type { OrphanedCard } from "../../state/state.types";
import { OrphanedCardsHeader } from "./OrphanedCardsHeader";
import { OrphanedCardsContent } from "./OrphanedCardsContent";
import { MoveCardModal } from "../modals/MoveCardModal";
import { FlashcardEditorModal } from "../modals/FlashcardEditorModal";
import type EpistemePlugin from "../../main";

/**
 * Orphaned Cards View
 * Panel for managing flashcards without assigned source notes
 */
export class OrphanedCardsView extends ItemView {
	private plugin: EpistemePlugin;
	private stateManager = createOrphanedCardsStateManager();

	// UI Components
	private headerComponent: OrphanedCardsHeader | null = null;
	private contentComponent: OrphanedCardsContent | null = null;

	// Container elements
	private headerContainer!: HTMLElement;
	private contentContainer!: HTMLElement;

	// State subscription
	private unsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ORPHANED_CARDS;
	}

	getDisplayText(): string {
		return "Orphaned cards";
	}

	getIcon(): string {
		return "unlink";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass("episteme-panel-view");

		// Create container elements
		this.headerContainer = container.createDiv({
			cls: "episteme-panel-header-container",
		});
		this.contentContainer = container.createDiv({
			cls: "episteme-panel-content-container",
		});

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() => this.render());

		// Initial render
		this.render();

		// Load orphaned cards
		void this.loadOrphanedCards();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.headerComponent?.destroy();
		this.contentComponent?.destroy();
	}

	/**
	 * Load orphaned cards from store
	 */
	private async loadOrphanedCards(): Promise<void> {
		this.stateManager.setLoading(true);

		const cards = this.plugin.flashcardManager.getOrphanedCards();
		const orphanedCards: OrphanedCard[] = cards.map((c) => ({
			id: c.id,
			question: c.question,
			answer: c.answer,
		}));

		this.stateManager.setOrphanedCards(orphanedCards);

		// Focus search after loading
		this.contentComponent?.focusSearch();
	}

	/**
	 * Handle assigning a single card to a note
	 */
	private async handleAssignCard(cardId: string): Promise<void> {
		const card = this.stateManager.getState().allOrphanedCards.find((c) => c.id === cardId);
		if (!card) return;

		const modal = new MoveCardModal(this.app, {
			cardCount: 1,
			cardQuestion: card.question,
			cardAnswer: card.answer,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		const success = await this.plugin.flashcardManager.assignCardToSourceNote(
			cardId,
			result.targetNotePath
		);

		if (success) {
			this.stateManager.removeCards([cardId]);
			new Notice("Card assigned to note");
		} else {
			new Notice("Failed to assign card");
		}
	}

	/**
	 * Handle assigning multiple cards to a note
	 */
	private async handleBulkAssign(): Promise<void> {
		const selectedIds = [...this.stateManager.getState().selectedCardIds];
		if (selectedIds.length === 0) return;

		const modal = new MoveCardModal(this.app, {
			cardCount: selectedIds.length,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		const successCount = await this.plugin.flashcardManager.assignCardsToSourceNote(
			selectedIds,
			result.targetNotePath
		);

		if (successCount > 0) {
			this.stateManager.removeCards(selectedIds);
			new Notice(`${successCount} card(s) assigned to note`);
		} else {
			new Notice("Failed to assign cards");
		}
	}

	/**
	 * Handle deleting a single card
	 */
	private async handleDeleteCard(cardId: string): Promise<void> {
		const success = await this.plugin.flashcardManager.removeFlashcardById(cardId);
		if (success) {
			this.stateManager.removeCards([cardId]);
			new Notice("Card deleted");
		} else {
			new Notice("Failed to delete card");
		}
	}

	/**
	 * Handle deleting multiple cards
	 */
	private async handleBulkDelete(): Promise<void> {
		const selectedIds = [...this.stateManager.getState().selectedCardIds];
		if (selectedIds.length === 0) return;

		let deleteCount = 0;
		for (const cardId of selectedIds) {
			const success = await this.plugin.flashcardManager.removeFlashcardById(cardId);
			if (success) deleteCount++;
		}

		if (deleteCount > 0) {
			this.stateManager.removeCards(selectedIds);
			new Notice(`${deleteCount} card(s) deleted`);
		}
	}

	/**
	 * Handle in-place edit save (Ctrl/Cmd+click on field)
	 */
	private async handleEditSave(
		card: OrphanedCard,
		field: "question" | "answer",
		newContent: string
	): Promise<void> {
		try {
			if (field === "question") {
				this.plugin.flashcardManager.updateCardContent(card.id, newContent, card.answer);
			} else {
				this.plugin.flashcardManager.updateCardContent(card.id, card.question, newContent);
			}

			// Update card in state
			const state = this.stateManager.getState();
			const updatedCards = state.allOrphanedCards.map((c) =>
				c.id === card.id ? { ...c, [field]: newContent } : c
			);
			this.stateManager.setOrphanedCards(updatedCards);

			new Notice("Flashcard updated");
		} catch (error) {
			new Notice(`Failed to update: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Handle edit button click (opens FlashcardEditorModal)
	 */
	private async handleEditButton(card: OrphanedCard): Promise<void> {
		const modal = new FlashcardEditorModal(this.app, {
			mode: "edit",
			card: {
				id: card.id,
				question: card.question,
				answer: card.answer,
				filePath: "",
				fsrs: {
					id: card.id,
					due: new Date().toISOString(),
					stability: 0,
					difficulty: 0,
					scheduledDays: 0,
					reps: 0,
					lapses: 0,
					state: 0,
					lastReview: null,
					learningStep: 0,
				},
				projects: [],
			},
			currentFilePath: "",
			sourceNoteName: "Orphaned Card",
			projects: [],
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		try {
			this.plugin.flashcardManager.updateCardContent(card.id, result.question, result.answer);

			// If source was changed, assign the card to a note (moves it out of orphaned)
			if (result.newSourceNotePath) {
				await this.plugin.flashcardManager.moveCard(
					card.id,
					"",
					result.newSourceNotePath
				);
				// Remove from orphaned cards list since it's now assigned
				const state = this.stateManager.getState();
				const updatedCards = state.allOrphanedCards.filter((c) => c.id !== card.id);
				this.stateManager.setOrphanedCards(updatedCards);
				new Notice("Flashcard updated and assigned to note");
			} else {
				// Update card in state
				const state = this.stateManager.getState();
				const updatedCards = state.allOrphanedCards.map((c) =>
					c.id === card.id ? { ...c, question: result.question, answer: result.answer } : c
				);
				this.stateManager.setOrphanedCards(updatedCards);
				new Notice("Flashcard updated");
			}
		} catch (error) {
			new Notice(`Failed to update: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Handle copy card to clipboard
	 */
	private async handleCopyCard(card: OrphanedCard): Promise<void> {
		const text = `Q: ${card.question}\nA: ${card.answer}`;
		await navigator.clipboard.writeText(text);
		new Notice("Copied to clipboard");
	}

	/**
	 * Render all components
	 */
	private render(): void {
		const state = this.stateManager.getState();
		const filteredCards = this.stateManager.getFilteredCards();

		// Render Header
		this.headerComponent?.destroy();
		this.headerContainer.empty();
		this.headerComponent = new OrphanedCardsHeader(this.headerContainer, {
			count: state.allOrphanedCards.length,
			selectedCount: state.selectedCardIds.size,
			isLoading: state.isLoading,
			onBulkAssign: () => void this.handleBulkAssign(),
			onBulkDelete: () => void this.handleBulkDelete(),
		});
		this.headerComponent.render();

		// Render Content
		this.contentComponent?.destroy();
		this.contentContainer.empty();
		this.contentComponent = new OrphanedCardsContent(this.contentContainer, {
			isLoading: state.isLoading,
			filteredCards,
			totalCount: state.allOrphanedCards.length,
			searchQuery: state.searchQuery,
			selectedCardIds: state.selectedCardIds,
			app: this.app,
			component: this,
			onSearchChange: (query) => this.stateManager.setSearchQuery(query),
			onCardSelect: (cardId) => this.stateManager.toggleCardSelection(cardId),
			onSelectAll: () => this.stateManager.selectAllFiltered(),
			onClearSelection: () => this.stateManager.clearSelection(),
			onAssignCard: (cardId) => void this.handleAssignCard(cardId),
			onDeleteCard: (cardId) => void this.handleDeleteCard(cardId),
			onEditSave: (card, field, newContent) => this.handleEditSave(card, field, newContent),
			onEditButton: (card) => void this.handleEditButton(card),
			onCopyCard: (card) => void this.handleCopyCard(card),
		});
		this.contentComponent.render();
	}
}
