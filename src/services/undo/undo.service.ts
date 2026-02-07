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
	onUndoAnswer: (payload: AnswerUndoPayload, writeCancelled: boolean) => Promise<void>;
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
		const writeCancelled = entry.cancelPendingWrite?.() ?? false;
		const { flashcardManager } = this.plugin;
		const payload = entry.payload;

		switch (payload.type) {
			case "create":
				return await flashcardManager.removeFlashcardById(payload.cardId);

			case "update":
				flashcardManager.updateCardContent(
					payload.cardId,
					payload.previousQuestion,
					payload.previousAnswer
				);
				return true;

			case "delete":
				return this.restoreDeletedCard(payload.cardData);

			case "batch-create":
				for (const cardId of payload.cardIds) {
					await flashcardManager.removeFlashcardById(cardId);
				}
				return true;

			case "answer":
				return await this.undoAnswer(payload, writeCancelled);

			case "bury":
				return this.undoBury(payload, writeCancelled);

			case "suspend":
				return this.undoSuspend(payload, writeCancelled);

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

	private async undoAnswer(payload: AnswerUndoPayload, writeCancelled: boolean): Promise<boolean> {
		// If the deferred write was cancelled, DB still has original FSRS — no write needed
		if (!writeCancelled) {
			this.plugin.flashcardManager.updateCardFSRS(payload.card.id, payload.originalFsrs);
		}

		if (this.reviewCallbacks) {
			await this.reviewCallbacks.onUndoAnswer(payload, writeCancelled);
			this.reviewCallbacks.onUpdateSchedulingPreview();
		}

		return true;
	}

	private undoBury(payload: BuryUndoPayload, writeCancelled: boolean): boolean {
		const { flashcardManager } = this.plugin;

		if (!writeCancelled) {
			flashcardManager.updateCardFSRS(payload.card.id, payload.originalFsrs);
		}

		if (this.reviewStateManager) {
			this.reviewStateManager.insertCardAtPosition(
				{ ...payload.card, fsrs: payload.originalFsrs },
				payload.previousIndex
			);
		}

		if (payload.additionalCards) {
			for (const additionalCard of payload.additionalCards) {
				if (!writeCancelled) {
					flashcardManager.updateCardFSRS(
						additionalCard.card.id,
						additionalCard.originalFsrs
					);
				}
			}
		}

		if (this.reviewCallbacks) {
			this.reviewCallbacks.onUpdateSchedulingPreview();
		}

		return true;
	}

	private undoSuspend(payload: SuspendUndoPayload, writeCancelled: boolean): boolean {
		if (!writeCancelled) {
			this.plugin.flashcardManager.updateCardFSRS(payload.card.id, payload.originalFsrs);
		}

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
