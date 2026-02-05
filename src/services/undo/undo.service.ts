import type TrueRecallPlugin from "../../main";
import type { FSRSCardData } from "../../types";
import type { ReviewApi } from "../../state/store";
import { getEventBus, notify } from "../index";
import type {
	UndoEntry,
	AnswerUndoPayload,
	BuryUndoPayload,
	SuspendUndoPayload,
	FSRSHelperUndoPayload,
} from "./undo.types";

export interface ReviewUndoCallbacks {
	onUpdateSchedulingPreview: () => void;
	onUndoAnswer: (payload: AnswerUndoPayload) => Promise<void>;
}

export class UndoService {
	private stack: UndoEntry[] = [];
	private readonly maxStackSize = 50;
	private plugin: TrueRecallPlugin;
	/** ReviewApi for inserting cards back into queue (set when ReviewView is open) */
	private reviewStateManager: ReviewApi | null = null;
	/** Callbacks for review session updates */
	private reviewCallbacks: ReviewUndoCallbacks | null = null;

	constructor(plugin: TrueRecallPlugin) {
		this.plugin = plugin;
	}

	setReviewStateManager(
		manager: ReviewApi | null,
		callbacks: ReviewUndoCallbacks | null
	): void {
		this.reviewStateManager = manager;
		this.reviewCallbacks = callbacks;
	}

	push(entry: UndoEntry): void {
		this.stack.push(entry);

		// Trim stack if exceeds max size
		if (this.stack.length > this.maxStackSize) {
			this.stack.shift();
		}
	}

	canUndo(): boolean {
		return this.stack.length > 0;
	}

	peekDescription(): string | null {
		const entry = this.stack[this.stack.length - 1];
		return entry?.description ?? null;
	}

	getStackSize(): number {
		return this.stack.length;
	}

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

			return success;
		} catch (error) {
			console.error("[UndoService] Error executing undo:", error);
			notify().undoFailed(entry.description);
			return false;
		}
	}

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

			case "fsrs-helper-operation":
				return this.undoFSRSHelperOperation(payload);

			default:
				console.warn(`[UndoService] Unknown undo payload type`);
				return false;
		}
	}

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

	private undoFSRSHelperOperation(payload: FSRSHelperUndoPayload): boolean {
		try {
			const { cardStore } = this.plugin;

			for (const change of payload.changes) {
				cardStore.cards.updateCardDue(change.cardId, change.originalDue);
			}

			// Emit bulk change event for UI sync
			getEventBus().emit({
				type: "cards:bulk-change",
				action: "reschedule",
				cardIds: payload.changes.map((c) => c.cardId),
				timestamp: Date.now(),
			});

			return true;
		} catch (error) {
			console.error("[UndoService] Failed to undo FSRS Helper operation:", error);
			return false;
		}
	}

	clear(): void {
		this.stack = [];
	}

	clearSessionEntries(): void {
		const sessionTypes = new Set(["answer", "bury", "suspend"]);
		this.stack = this.stack.filter(
			(entry) => !sessionTypes.has(entry.payload.type)
		);
	}
}
