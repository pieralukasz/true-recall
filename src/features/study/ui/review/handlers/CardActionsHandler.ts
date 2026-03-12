/**
 * Card Actions Handler for ReviewView
 * Handles card operations: suspend, bury, move, add, copy, edit
 */

import type { SqliteStoreService } from "@features/core/persistence/sqlite";
import type { FSRSService } from "@features/core/services/fsrs.service";
import { QuickNoteEditorModal } from "@features/study/modals/quick-note-editor/QuickNoteEditorModal";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { ReviewService } from "@features/study/services/review.service";
import { notify } from "@shared/services/notification.service";
import { notifyCardChange } from "@shared/services/signals";
import type { ReviewApi } from "@shared/store";
import type { TrueRecallSettings } from "@shared/types";
import { BUILTIN_IMAGE_OCCLUSION_ID } from "@shared/types/note.types";
import { MoveCardModal } from "@shared/ui/modals";
import type { App } from "obsidian";
import { Rating, State } from "ts-fsrs";
import type TrueRecallPlugin from "../../../../../main";

const FORGET_NON_NEW_WARNING =
	"Forget is only available for cards that are not New.";

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

	constructor(deps: CardActionsHandlerDeps, callbacks: CardActionsCallbacks) {
		this.deps = deps;
		this.callbacks = callbacks;
	}

	/**
	 * Check if undo is available (delegated to global UndoService)
	 */
	canUndo(): boolean {
		return this.deps.plugin.undoService?.canUndo() ?? false;
	}

	canForgetCurrentCard(): boolean {
		const card = this.deps.getReview().getCurrentCard();
		return !!card && card.fsrs.state !== State.New;
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
			description:
				siblingIds.length > 1
					? `Suspend ${siblingIds.length} cards`
					: "Suspend card",
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
						this.deps.flashcardManager.updateCardFSRS(id, {
							...siblingData,
							suspended: true,
						});
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
			description:
				siblingIds.length > 1 ? `Bury ${siblingIds.length} cards` : "Bury card",
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
						this.deps.flashcardManager.updateCardFSRS(id, {
							...siblingData,
							buriedUntil,
						});
					}
				}
			} catch (error) {
				console.error("[CardActionsHandler] Error burying card(s):", error);
			}
		}, 0);
	}

	/**
	 * Forget the current card — reset to New and clear review history.
	 * For cloze/reverse cards, forgets all siblings as a group.
	 */
	async handleForget(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;
		if (card.fsrs.state === State.New) {
			notify().warning(FORGET_NON_NEW_WARNING);
			return;
		}

		const currentIndex = this.deps.getReview().currentIndex;
		const undoService = this.deps.plugin.undoService;

		const siblingIds = this.getGroupSiblingIds(card);
		const forgettableIds = siblingIds.filter((id) => {
			if (id === card.id) {
				return card.fsrs.state !== State.New;
			}
			const sibling = this.deps.cardStore.get(id);
			return !!sibling && sibling.state !== State.New;
		});
		if (forgettableIds.length === 0) {
			notify().warning(FORGET_NON_NEW_WARNING);
			return;
		}

		let writeExecuted = false;
		let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

		undoService?.push({
			id: crypto.randomUUID(),
			actionType: "forget",
			description:
				forgettableIds.length > 1
					? `Forget ${forgettableIds.length} cards`
					: "Forget card",
			timestamp: Date.now(),
			payload: {
				type: "forget",
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

		for (const id of forgettableIds) {
			this.deps.getReview().removeCardById(id);
		}

		if (!this.deps.getReview().isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		if (forgettableIds.length === 1) {
			notify().cardForgotten();
		} else {
			notify().cardsForgotten(forgettableIds.length);
		}

		pendingTimeoutId = setTimeout(() => {
			writeExecuted = true;
			pendingTimeoutId = null;
			try {
				this.deps.cardStore.cards.bulkForget(forgettableIds);
				this.deps.plugin.sessionPersistence?.removeReviewedCards(
					forgettableIds,
				);
				notifyCardChange({
					type: "bulk",
					cardIds: forgettableIds,
					action: "reset",
				});
			} catch (error) {
				console.error("[CardActionsHandler] Error forgetting card(s):", error);
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
		const siblingCards = queue.filter(
			(c) => c.sourceNoteName === sourceNoteName,
		);

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
		const additionalCards = siblingCards.slice(1).map((c) => ({
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
				console.error(
					`[CardActionsHandler] Error burying card ${siblingCard.id}:`,
					error,
				);
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
					additionalCards:
						additionalCards.length > 0 ? additionalCards : undefined,
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
			const { persisted } = await this.deps.reviewService.gradeCard(
				card,
				Rating.Good,
				this.deps.fsrsService,
				this.deps.flashcardManager,
			);
			if (!persisted) {
				this.deps.getReview().removeCardById(card.id);
				if (!this.deps.getReview().isComplete()) {
					this.callbacks.onUpdateSchedulingPreview();
				}
				notify().warning("Card was deleted before move could be saved.");
				return;
			}

			// Move the card
			const success = await this.deps.flashcardManager.moveCard(
				card.id,
				result.targetNotePath,
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
	 * Add a new flashcard linked to the same source as the current card.
	 */
	async handleAddNewFlashcard(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const modal = new QuickNoteEditorModal(this.deps.app, this.deps.plugin, {
			mode: "add",
			sourceUid: card.sourceUid,
			defaultNoteTypeId:
				card.fsrs.noteTypeId === BUILTIN_IMAGE_OCCLUSION_ID
					? "builtin-basic"
					: (card.fsrs.noteTypeId ?? "builtin-basic"),
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		const cardCount = result.createdCards?.length ?? 0;
		if (cardCount > 0) {
			this.deps.plugin.undoService?.push({
				id: crypto.randomUUID(),
				actionType: "batch-create",
				description: `Add ${cardCount} card${cardCount !== 1 ? "s" : ""}`,
				timestamp: Date.now(),
				payload: {
					type: "batch-create",
					cardIds: result.createdCards?.map((c) => c.id) ?? [],
				},
			});
			const noteName = card.sourceNotePath
				?.split("/")
				.pop()
				?.replace(/\.md$/, "");
			notify().cardsCreated(cardCount, noteName);
		}
	}

	/**
	 * Add a new image occlusion card linked to the same source as the current card.
	 */
	async handleAddImageOcclusion(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const result = await this.deps.plugin.openImageOcclusionEditor({
			mode: "add",
			sourceUid: card.sourceUid,
		});
		if (result.cancelled) return;

		const cardCount = result.createdCards?.length ?? 0;
		if (cardCount > 0) {
			this.deps.plugin.undoService?.push({
				id: crypto.randomUUID(),
				actionType: "batch-create",
				description: `Add ${cardCount} image occlusion card${cardCount !== 1 ? "s" : ""}`,
				timestamp: Date.now(),
				payload: {
					type: "batch-create",
					cardIds: result.createdCards?.map((c) => c.id) ?? [],
				},
			});
			const noteName = card.sourceNotePath
				?.split("/")
				.pop()
				?.replace(/\.md$/, "");
			notify().cardsCreated(cardCount, noteName);
		}
	}

	/**
	 * Edit the current card via the QuickNoteEditor modal (v26 note-aware).
	 */
	async handleEditCardModal(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		if (!card.noteId) {
			notify().error(
				"Cannot edit card: missing note link. Please restart Obsidian to complete database migration.",
			);
			return;
		}

		const note = this.deps.cardStore.notes.getById(card.noteId);
		if (!note) {
			notify().error("Note not found");
			return;
		}
		const noteType = this.deps.cardStore.noteTypes.getById(note.noteTypeId);
		if (!noteType) {
			notify().error("Note type not found");
			return;
		}

		const previousFields = { ...note.fields };

		if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
			const result = await this.deps.plugin.openImageOcclusionEditor({
				mode: "edit",
				noteId: note.id,
				note,
			});
			if (result.cancelled) return;

			this.deps.plugin.undoService?.push({
				id: crypto.randomUUID(),
				actionType: "update-note-fields",
				description: "Edit image occlusion",
				timestamp: Date.now(),
				payload: {
					type: "update-note-fields",
					noteId: note.id,
					previousFields,
				},
			});
			return;
		}

		const modal = new QuickNoteEditorModal(this.deps.app, this.deps.plugin, {
			mode: "edit",
			cardId: card.id,
			noteId: note.id,
			note,
			noteType,
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		// Push undo entry for note-level field edit
		this.deps.plugin.undoService?.push({
			id: crypto.randomUUID(),
			actionType: "update-note-fields",
			description: "Edit card",
			timestamp: Date.now(),
			payload: {
				type: "update-note-fields",
				noteId: note.id,
				previousFields,
			},
		});

		// Refresh the current card display in review
		if (result.updatedCardIds?.includes(card.id)) {
			const [updatedCard] = this.deps.cardStore.cards.getByIds([card.id]);
			if (updatedCard) {
				this.deps
					.getReview()
					.updateCurrentCardContent(
						updatedCard.question ?? card.question,
						updatedCard.answer ?? card.answer ?? "",
					);
			}
		}
	}

	/**
	 * Change the note type for the current card's note.
	 * Opens ChangeNoteTypeModal, then reconciles cards and updates the review queue.
	 */
	async handleChangeNoteType(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card?.noteId) return;

		const note = this.deps.cardStore.notes.getById(card.noteId);
		if (!note) {
			notify().error("Note not found");
			return;
		}

		const currentNoteType = this.deps.cardStore.noteTypes.getById(
			note.noteTypeId,
		);
		if (!currentNoteType) {
			notify().error("Note type not found");
			return;
		}

		const { ChangeNoteTypeModal } = await import(
			"@features/library/modals/ChangeNoteTypeModal"
		);

		const allNoteTypes = this.deps.cardStore.noteTypes.getAll();
		const modal = new ChangeNoteTypeModal(this.deps.app, {
			currentNoteType,
			availableNoteTypes: allNoteTypes,
			noteCount: 1,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
			return;

		const r = this.deps.flashcardManager.changeNoteType(
			card.noteId,
			result.targetNoteTypeId,
			result.fieldMapping,
		);

		// Remove deleted cards from review queue
		for (const id of r.deletedCardIds) {
			this.deps.getReview().removeCardById(id);
		}
		// If current card was not kept, remove it too
		if (!r.keptCardIds.includes(card.id)) {
			this.deps.getReview().removeCardById(card.id);
		}

		if (!this.deps.getReview().isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		const parts: string[] = ["Note type changed"];
		if (r.createdCardIds.length > 0)
			parts.push(`${r.createdCardIds.length} cards created`);
		if (r.deletedCardIds.length > 0)
			parts.push(`${r.deletedCardIds.length} cards removed`);
		notify().success(parts.join(", "));
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
	private getGroupSiblingIds(card: {
		id: string;
		cardType?: string;
		sourceUid?: string;
		clozeTemplate?: string;
		reverseOf?: string;
	}): string[] {
		// Cloze card: get all cards sharing the same template
		if (card.cardType === "cloze" && card.sourceUid && card.clozeTemplate) {
			const siblings = this.deps.cardStore.getClozeSiblings(
				card.sourceUid,
				card.clozeTemplate,
			);
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
