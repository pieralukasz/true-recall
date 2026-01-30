/**
 * Undo Service
 * Manages undo stack for flashcard mutation operations
 */

import type TrueRecallPlugin from "../../main";
import type { FSRSCardData } from "../../types";
import { getEventBus, notify } from "../index";
import type { UndoEntry } from "./undo.types";

/**
 * Service for managing undo operations on flashcard mutations
 */
export class UndoService {
	private stack: UndoEntry[] = [];
	private readonly maxStackSize = 50;
	private plugin: TrueRecallPlugin;

	constructor(plugin: TrueRecallPlugin) {
		this.plugin = plugin;
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
		const { flashcardManager, cardStore } = this.plugin;
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
	 * Clear the undo stack (e.g., on session end)
	 */
	clear(): void {
		this.stack = [];
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
