/**
 * Undo Service
 * Manages undo stack for flashcard mutation operations
 */

import type TrueRecallPlugin from "../../main";
import type { FSRSCardData } from "../../types";
import type { ReviewStateManager } from "../../state";
import { getEventBus, notify } from "../index";
import type {
	UndoEntry,
	AnswerUndoPayload,
	BuryUndoPayload,
	SuspendUndoPayload,
} from "./undo.types";

/**
 * Callback interface for review session updates after undo
 */
export interface ReviewUndoCallbacks {
	onUpdateSchedulingPreview: () => void;
	onUndoAnswer: (payload: AnswerUndoPayload) => Promise<void>;
}

/**
 * Service for managing undo operations on flashcard mutations
 */
export class UndoService {
	private stack: UndoEntry[] = [];
	private readonly maxStackSize = 50;
	private plugin: TrueRecallPlugin;
	/** ReviewStateManager for inserting cards back into queue (set when ReviewView is open) */
	private reviewStateManager: ReviewStateManager | null = null;
	/** Callbacks for review session updates */
	private reviewCallbacks: ReviewUndoCallbacks | null = null;

	constructor(plugin: TrueRecallPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Set the ReviewStateManager (called when ReviewView opens)
	 */
	setReviewStateManager(
		manager: ReviewStateManager | null,
		callbacks: ReviewUndoCallbacks | null
	): void {
		this.reviewStateManager = manager;
		this.reviewCallbacks = callbacks;
	}

	/**
	 * Push an undo entry onto the stack
	 */
	push(entry: UndoEntry): void {
		this.stack.push(entry);

		// Trim stack if exceeds max size
		if (this.stack.length > this.maxStackSize) {
			this.stack.shift();
		}

		// Emit event for UI updates
		this.emitUndoChanged();
	}

	/**
	 * Check if undo is available
	 */
	canUndo(): boolean {
		return this.stack.length > 0;
	}

	/**
	 * Get description of next undo action (for UI display)
	 */
	peekDescription(): string | null {
		const entry = this.stack[this.stack.length - 1];
		return entry?.description ?? null;
	}

	/**
	 * Get the number of entries in the undo stack
	 */
	getStackSize(): number {
		return this.stack.length;
	}

	/**
	 * Execute undo for the last action
	 */
	async undo(): Promise<boolean> {
		const entry = this.stack.pop();
		if (!entry) {
			notify().nothingToUndo();
			return false;
		}

		try {
			const success = await this.executeUndo(entry);
			if (success) {
				notify().undoComplete(entry.description);
			} else {
				notify().undoFailed(entry.description);
			}

			// Emit event for UI updates
			this.emitUndoChanged();

			return success;
		} catch (error) {
			console.error("[UndoService] Error executing undo:", error);
			notify().undoFailed(entry.description);
			this.emitUndoChanged();
			return false;
		}
	}

	/**
	 * Execute the actual undo based on payload type
	 */
	private async executeUndo(entry: UndoEntry): Promise<boolean> {
		const { flashcardManager } = this.plugin;
		const payload = entry.payload;

		switch (payload.type) {
			case "create":
				// Undo create = delete the card
				return await flashcardManager.removeFlashcardById(payload.cardId);

			case "update":
				// Undo update = restore previous content
				flashcardManager.updateCardContent(
					payload.cardId,
					payload.previousQuestion,
					payload.previousAnswer
				);
				return true;

			case "delete":
				// Undo delete = restore the card
				return this.restoreDeletedCard(payload.cardData);

			case "batch-create":
				// Undo batch create = delete all created cards
				for (const cardId of payload.cardIds) {
					await flashcardManager.removeFlashcardById(cardId);
				}
				return true;

			case "answer":
				return await this.undoAnswer(payload);

			case "bury":
				return this.undoBury(payload);

			case "suspend":
				return this.undoSuspend(payload);

			default:
				console.warn(`[UndoService] Unknown undo payload type`);
				return false;
		}
	}

	/**
	 * Restore a deleted card to the database
	 */
	private restoreDeletedCard(cardData: FSRSCardData): boolean {
		try {
			const { cardStore } = this.plugin;

			// Restore the card using the store's set method
			cardStore.set(cardData.id, cardData);

			// Emit event for UI sync
			getEventBus().emit({
				type: "card:added",
				cardId: cardData.id,
				timestamp: Date.now(),
			});

			return true;
		} catch (error) {
			console.error("[UndoService] Error restoring card:", error);
			return false;
		}
	}

	/**
	 * Undo an answer action (restore FSRS state and re-queue card)
	 * Note: undoLastAnswer() handles queue restoration + stats reversion,
	 * so we don't call insertCardAtPosition here (would cause duplicate)
	 */
	private async undoAnswer(payload: AnswerUndoPayload): Promise<boolean> {
		const { flashcardManager } = this.plugin;

		// Restore original FSRS data
		flashcardManager.updateCardFSRS(payload.card.id, payload.originalFsrs);

		// Call review-specific callbacks (e.g., update session persistence)
		// onUndoAnswer calls undoLastAnswer() which handles queue + stats
		if (this.reviewCallbacks) {
			await this.reviewCallbacks.onUndoAnswer(payload);
			this.reviewCallbacks.onUpdateSchedulingPreview();
		}

		return true;
	}

	/**
	 * Undo a bury action (restore buriedUntil and re-queue card)
	 */
	private undoBury(payload: BuryUndoPayload): boolean {
		const { flashcardManager } = this.plugin;

		// Restore original FSRS data for main card
		flashcardManager.updateCardFSRS(payload.card.id, payload.originalFsrs);

		// Re-insert main card at original position
		if (this.reviewStateManager) {
			this.reviewStateManager.insertCardAtPosition(
				{ ...payload.card, fsrs: payload.originalFsrs },
				payload.previousIndex
			);
		}

		// Restore additional cards (for "bury note" operation)
		if (payload.additionalCards) {
			for (const additionalCard of payload.additionalCards) {
				flashcardManager.updateCardFSRS(
					additionalCard.card.id,
					additionalCard.originalFsrs
				);
				// Note: We don't re-insert additional cards as they might have been after current position
			}
		}

		if (this.reviewCallbacks) {
			this.reviewCallbacks.onUpdateSchedulingPreview();
		}

		return true;
	}

	/**
	 * Undo a suspend action (restore suspended flag and re-queue card)
	 */
	private undoSuspend(payload: SuspendUndoPayload): boolean {
		const { flashcardManager } = this.plugin;

		// Restore original FSRS data (with suspended: false)
		flashcardManager.updateCardFSRS(payload.card.id, payload.originalFsrs);

		// Re-insert card at original position
		if (this.reviewStateManager) {
			this.reviewStateManager.insertCardAtPosition(
				{ ...payload.card, fsrs: payload.originalFsrs },
				payload.previousIndex
			);
		}

		if (this.reviewCallbacks) {
			this.reviewCallbacks.onUpdateSchedulingPreview();
		}

		return true;
	}

	/**
	 * Clear the undo stack (e.g., on session end)
	 */
	clear(): void {
		this.stack = [];
		this.emitUndoChanged();
	}

	/**
	 * Clear only review session-specific entries (answer, bury, suspend)
	 * Keeps global mutation entries (create, update, delete, batch-create)
	 */
	clearSessionEntries(): void {
		const sessionTypes = new Set(["answer", "bury", "suspend"]);
		this.stack = this.stack.filter(
			(entry) => !sessionTypes.has(entry.payload.type)
		);
		this.emitUndoChanged();
	}

	/**
	 * Emit undo state change event
	 */
	private emitUndoChanged(): void {
		getEventBus().emit({
			type: "undo:changed",
			canUndo: this.stack.length > 0,
			timestamp: Date.now(),
		});
	}
}
