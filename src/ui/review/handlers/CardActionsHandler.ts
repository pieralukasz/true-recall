/**
 * Card Actions Handler for ReviewView
 * Handles card operations: suspend, bury, move, add, copy, edit
 */
import { App } from "obsidian";
import { Rating } from "ts-fsrs";
import type { FlashcardManager, FSRSService, ReviewService, SqliteStoreService } from "../../../services";
import type { TrueRecallSettings } from "../../../types";
import { MoveCardModal, SimpleFlashcardEditorModal } from "../../modals";
import { notify } from "../../../services";
import { cardToMarkdown } from "../../../services/flashcard/flashcard-format.util";
import { DuplicateQuestionError } from "../../../services/flashcard/card-repository.service";
import type TrueRecallPlugin from "../../../main";
import type { ReviewApi } from "../../../state/store";

/**
 * Dependencies required by CardActionsHandler
 */
export interface CardActionsHandlerDeps {
	app: App;
	getReview: () => ReviewApi;
	flashcardManager: FlashcardManager;
	fsrsService: FSRSService;
	reviewService: ReviewService;
	/** SQLite store for registering source notes */
	cardStore: SqliteStoreService;
	settings: TrueRecallSettings;
	/** Plugin instance for accessing AgentService */
	plugin: TrueRecallPlugin;
}

/**
 * Callbacks for actions that require view updates
 */
export interface CardActionsCallbacks {
	onUpdateSchedulingPreview: () => void;
}

/**
 * CardActionsHandler encapsulates card manipulation logic
 *
 * Extracts business logic from ReviewView for:
 * - Suspend/bury operations
 * - Move card to another note
 * - Add/copy/edit flashcards
 * - Undo operations (delegated to global UndoService)
 */
export class CardActionsHandler {
	private deps: CardActionsHandlerDeps;
	private callbacks: CardActionsCallbacks;

	constructor(
		deps: CardActionsHandlerDeps,
		callbacks: CardActionsCallbacks
	) {
		this.deps = deps;
		this.callbacks = callbacks;
	}

	/**
	 * Check if undo is available (delegated to global UndoService)
	 */
	canUndo(): boolean {
		return this.deps.plugin.undoService?.canUndo() ?? false;
	}

	/**
	 * Suspend the current card
	 * For cloze/reverse cards, suspends all siblings as a group
	 */
	async handleSuspend(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const currentIndex = this.deps.getReview().currentIndex;
		const undoService = this.deps.plugin.undoService;

		// Find cloze siblings in the review queue
		const siblingIds = this.getGroupSiblingIds(card);

		let writeExecuted = false;
		let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

		undoService?.push({
			id: crypto.randomUUID(),
			actionType: "suspend",
			description: siblingIds.length > 1 ? `Suspend ${siblingIds.length} cards` : "Suspend card",
			timestamp: Date.now(),
			payload: {
				type: "suspend",
				card: { ...card },
				originalFsrs: { ...card.fsrs },
				previousIndex: currentIndex,
			},
			cancelPendingWrite: () => {
				if (!writeExecuted && pendingTimeoutId !== null) {
					clearTimeout(pendingTimeoutId);
					pendingTimeoutId = null;
					return true;
				}
				return false;
			},
		});

		// Remove all siblings from the review queue
		for (const id of siblingIds) {
			this.deps.getReview().removeCardById(id);
		}

		if (!this.deps.getReview().isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		notify().cardSuspended();

		pendingTimeoutId = setTimeout(() => {
			writeExecuted = true;
			pendingTimeoutId = null;
			try {
				// Suspend all siblings
				for (const id of siblingIds) {
					const siblingData = this.deps.cardStore.get(id);
					if (siblingData) {
						this.deps.flashcardManager.updateCardFSRS(id, { ...siblingData, suspended: true });
					}
				}
			} catch (error) {
				console.error("[CardActionsHandler] Error suspending card(s):", error);
			}
		}, 0);
	}

	/**
	 * Bury the current card until tomorrow
	 * For cloze/reverse cards, buries all siblings as a group
	 */
	async handleBuryCard(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const currentIndex = this.deps.getReview().currentIndex;
		const undoService = this.deps.plugin.undoService;

		const tomorrow = this.getTomorrowDate();
		const buriedUntil = tomorrow.toISOString();

		// Find cloze siblings in the review queue
		const siblingIds = this.getGroupSiblingIds(card);

		let writeExecuted = false;
		let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

		undoService?.push({
			id: crypto.randomUUID(),
			actionType: "bury",
			description: siblingIds.length > 1 ? `Bury ${siblingIds.length} cards` : "Bury card",
			timestamp: Date.now(),
			payload: {
				type: "bury",
				card: { ...card },
				originalFsrs: { ...card.fsrs },
				previousIndex: currentIndex,
			},
			cancelPendingWrite: () => {
				if (!writeExecuted && pendingTimeoutId !== null) {
					clearTimeout(pendingTimeoutId);
					pendingTimeoutId = null;
					return true;
				}
				return false;
			},
		});

		// Remove all siblings from the review queue
		for (const id of siblingIds) {
			this.deps.getReview().removeCardById(id);
		}

		if (!this.deps.getReview().isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		notify().cardBuried();

		pendingTimeoutId = setTimeout(() => {
			writeExecuted = true;
			pendingTimeoutId = null;
			try {
				// Bury all siblings
				for (const id of siblingIds) {
					const siblingData = this.deps.cardStore.get(id);
					if (siblingData) {
						this.deps.flashcardManager.updateCardFSRS(id, { ...siblingData, buriedUntil });
					}
				}
			} catch (error) {
				console.error("[CardActionsHandler] Error burying card(s):", error);
			}
		}, 0);
	}

	/**
	 * Bury all cards from the same source note
	 * All sibling cards will reappear in the next day's review
	 */
	async handleBuryNote(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const sourceNoteName = card.sourceNoteName;
		if (!sourceNoteName) {
			// If no source note, just bury the current card
			await this.handleBuryCard();
			return;
		}

		// Find all cards from the same source note in the queue
		const queue = this.deps.getReview().queue;
		const siblingCards = queue.filter(c => c.sourceNoteName === sourceNoteName);

		const firstSibling = siblingCards[0];
		if (siblingCards.length === 0 || !firstSibling) {
			await this.handleBuryCard();
			return;
		}

		const currentIndex = this.deps.getReview().currentIndex;
		const undoService = this.deps.plugin.undoService;

		// Calculate tomorrow's date based on dayStartHour
		const tomorrow = this.getTomorrowDate();
		const buriedUntil = tomorrow.toISOString();

		// Capture undo data for all sibling cards BEFORE making changes
		const additionalCards = siblingCards.slice(1).map(c => ({
			card: { ...c },
			originalFsrs: { ...c.fsrs },
		}));

		let buriedCount = 0;

		// Bury all sibling cards
		for (const siblingCard of siblingCards) {
			const updatedFsrs = { ...siblingCard.fsrs, buriedUntil };

			try {
				this.deps.flashcardManager.updateCardFSRS(siblingCard.id, updatedFsrs);
				buriedCount++;
			} catch (error) {
				console.error(`[CardActionsHandler] Error burying card ${siblingCard.id}:`, error);
			}

			// Remove from queue (by ID since indices change)
			this.deps.getReview().removeCardById(siblingCard.id);
		}

		// Push undo entry AFTER successful operations
		if (buriedCount > 0) {
			undoService?.push({
				id: crypto.randomUUID(),
				actionType: "bury",
				description: `Bury ${buriedCount} cards`,
				timestamp: Date.now(),
				payload: {
					type: "bury",
					card: { ...firstSibling },
					originalFsrs: { ...firstSibling.fsrs },
					previousIndex: currentIndex,
					additionalCards: additionalCards.length > 0 ? additionalCards : undefined,
				},
			});
		}

		// Update scheduling preview for next card
		if (!this.deps.getReview().isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		notify().cardsBuried(buriedCount);
		// Note: render triggered by removeCardById() → notifyListeners()
	}

	/**
	 * Move the current card to another note
	 */
	async handleMoveCard(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		// Open move modal with card content for backlink suggestions
		const modal = new MoveCardModal(this.deps.app, {
			cardCount: 1,
			sourceNoteName: card.sourceNoteName,
			cardQuestion: card.question,
			cardAnswer: card.answer,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		try {
			// Grade card as "Good" before moving (updates FSRS scheduling)
			await this.deps.reviewService.gradeCard(
				card,
				Rating.Good,
				this.deps.fsrsService,
				this.deps.flashcardManager
			);

			// Move the card
			const success = await this.deps.flashcardManager.moveCard(
				card.id,
				result.targetNotePath
			);

			if (success) {
				// Remove from current queue (card no longer exists in original file)
				this.deps.getReview().removeCurrentCard();

				// Update scheduling preview for next card
				if (!this.deps.getReview().isComplete()) {
					this.callbacks.onUpdateSchedulingPreview();
				}

				notify().cardGradedAndMoved();
			}
		} catch (error) {
			console.error("[CardActionsHandler] Error moving card:", error);
			notify().operationFailed("move card", error);
		}
	}

	/**
	 * Add new flashcards to the same file as the current card
	 */
	async handleAddNewFlashcard(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		// Open simple markdown editor modal
		const modal = new SimpleFlashcardEditorModal(this.deps.app, {
			mode: "add",
			currentFilePath: card.sourceNotePath || "",
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.flashcards.length === 0) return;

		try {
			// Add all parsed flashcards directly using the current card's sourceUid
			for (const flashcard of result.flashcards) {
				await this.deps.flashcardManager.addSingleFlashcard(
					flashcard.question,
					flashcard.answer,
					card.sourceUid
				);
			}

			const noteName = card.sourceNotePath?.split("/").pop()?.replace(/\.md$/, "");
			notify().cardsCreated(result.flashcards.length, noteName);
		} catch (error) {
			if (error instanceof DuplicateQuestionError) {
				const sourceInfo = error.existingSourceUid
					? this.deps.flashcardManager.getSourceNoteService().resolveSourceNote(error.existingSourceUid)
					: {};
				notify().duplicateFound(result.flashcards[0]?.question ?? "", sourceInfo.noteName);
			} else {
				console.error("[CardActionsHandler] Error adding flashcards:", error);
				notify().operationFailed("add flashcards", error);
			}
		}
	}

	/**
	 * Copy current card to new flashcard
	 * Opens simple markdown editor with current card's Q&A pre-filled
	 */
	async handleCopyCurrentCard(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		// Open modal with pre-filled content in markdown format
		const modal = new SimpleFlashcardEditorModal(this.deps.app, {
			mode: "add",
			currentFilePath: card.sourceNotePath || "",
			prefillContent: cardToMarkdown(card),
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.flashcards.length === 0) return;

		try {
			// Add all parsed flashcards directly using the current card's sourceUid
			for (const flashcard of result.flashcards) {
				await this.deps.flashcardManager.addSingleFlashcard(
					flashcard.question,
					flashcard.answer,
					card.sourceUid
				);
			}

			const noteName = card.sourceNotePath?.split("/").pop()?.replace(/\.md$/, "");
			notify().cardsCreated(result.flashcards.length, noteName);
		} catch (error) {
			if (error instanceof DuplicateQuestionError) {
				const sourceInfo = error.existingSourceUid
					? this.deps.flashcardManager.getSourceNoteService().resolveSourceNote(error.existingSourceUid)
					: {};
				notify().duplicateFound(result.flashcards[0]?.question ?? "", sourceInfo.noteName);
			} else {
				console.error("[CardActionsHandler] Error copying flashcard:", error);
				notify().operationFailed("copy flashcard", error);
			}
		}
	}

	/**
	 * Edit the current card via modal
	 * Uses direct FlashcardManager calls (no undo support for simplicity)
	 */
	async handleEditCardModal(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const modal = new SimpleFlashcardEditorModal(this.deps.app, {
			mode: "edit",
			currentFilePath: card.sourceNotePath || "",
			prefillContent: cardToMarkdown(card),
			editCardId: card.id,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.flashcards.length === 0) return;

		try {
			const firstFlashcard = result.flashcards[0];
			if (!firstFlashcard) return;

			// Cloze template editing: parser sets clozeTemplate on each parsed FlashcardItem
			if (card.cardType === "cloze" && card.clozeTemplate && card.sourceUid && firstFlashcard.clozeTemplate) {
				this.deps.flashcardManager.updateClozeTemplate(
					card.sourceUid,
					card.clozeTemplate,
					firstFlashcard.clozeTemplate,
					card.sourceNoteName
				);
				// Update current card in review queue with re-derived Q/A
				const thisCard = result.flashcards.find(c => c.clozeIndex === card.clozeIndex);
				if (thisCard) {
					this.deps.getReview().updateCurrentCardContent(thisCard.question, thisCard.answer);
				}
				notify().success("Updated cloze template");
				return;
			}

			// Basic/reversed card: update directly
			this.deps.flashcardManager.updateCardContent(
				card.id,
				firstFlashcard.question,
				firstFlashcard.answer
			);
			this.deps.getReview().updateCurrentCardContent(
				firstFlashcard.question,
				firstFlashcard.answer
			);

			// Additional flashcards (if any) are created as new cards directly
			if (result.flashcards.length > 1) {
				for (let i = 1; i < result.flashcards.length; i++) {
					const flashcard = result.flashcards[i];
					if (flashcard) {
						await this.deps.flashcardManager.addSingleFlashcard(
							flashcard.question,
							flashcard.answer,
							card.sourceUid
						);
					}
				}
				notify().success(`Updated card and created ${result.flashcards.length - 1} new cards`);
			} else {
				notify().cardUpdated();
			}
		} catch (error) {
			if (error instanceof DuplicateQuestionError) {
				const sourceInfo = error.existingSourceUid
					? this.deps.flashcardManager.getSourceNoteService().resolveSourceNote(error.existingSourceUid)
					: {};
				const question = result.flashcards[0]?.question ?? "";
				notify().duplicateFound(question, sourceInfo.noteName);
			} else {
				console.error("[CardActionsHandler] Error updating card:", error);
				notify().operationFailed("update card", error);
			}
		}
	}

	/**
	 * Undo the last action (delegated to global UndoService)
	 * All undo logic is now unified in UndoService for proper LIFO ordering
	 */
	async handleUndo(): Promise<boolean> {
		const undoService = this.deps.plugin.undoService;
		if (!undoService?.canUndo()) {
			notify().nothingToUndo();
			return false;
		}

		const success = await undoService.undo();
		// Note: render triggered by UndoService via insertCardAtPosition/undoLastAnswer → notifyListeners()
		return success;
	}

	/**
	 * Get IDs of all group siblings for cloze/reverse cards.
	 * Returns [card.id] for basic cards (no siblings).
	 */
	private getGroupSiblingIds(card: { id: string; cardType?: string; sourceUid?: string; clozeTemplate?: string; reverseOf?: string }): string[] {
		// Cloze card: get all cards sharing the same template
		if (card.cardType === "cloze" && card.sourceUid && card.clozeTemplate) {
			const siblings = this.deps.cardStore.getClozeSiblings(card.sourceUid, card.clozeTemplate);
			if (siblings.length > 0) {
				return siblings.map((s) => s.id);
			}
		}

		// Reversed card: include the paired card
		if (card.cardType === "reversed" && card.reverseOf) {
			return [card.id, card.reverseOf];
		}

		// Original card with a reverse
		const reverseCard = this.deps.cardStore.cards.getCardByReverseOf(card.id);
		if (reverseCard) {
			return [card.id, reverseCard.id];
		}

		return [card.id];
	}

	/**
	 * Calculate tomorrow's date based on dayStartHour setting
	 */
	private getTomorrowDate(): Date {
		const now = new Date();
		const tomorrow = new Date(now);

		// If we're past the day start hour, tomorrow means the next calendar day
		// If we're before the day start hour, tomorrow means today at dayStartHour
		if (now.getHours() >= this.deps.settings.dayStartHour) {
			tomorrow.setDate(tomorrow.getDate() + 1);
		}

		tomorrow.setHours(this.deps.settings.dayStartHour, 0, 0, 0);
		return tomorrow;
	}
}
