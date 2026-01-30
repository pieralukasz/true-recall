/**
 * Undo Service Types
 * Type definitions for the undo/redo system
 */

import type { FSRSCardData } from "../../types";

/**
 * Types of operations that can be undone
 */
export type UndoActionType =
	| "create-flashcard"
	| "update-card"
	| "delete-flashcard"
	| "save-flashcards";

/**
 * Payload for undoing card creation (delete the created card)
 */
export interface CreateUndoPayload {
	type: "create";
	cardId: string;
}

/**
 * Payload for undoing card update (restore previous content)
 */
export interface UpdateUndoPayload {
	type: "update";
	cardId: string;
	previousQuestion: string;
	previousAnswer: string;
}

/**
 * Payload for undoing card deletion (restore the card)
 */
export interface DeleteUndoPayload {
	type: "delete";
	/** Full card data to restore */
	cardData: FSRSCardData;
}

/**
 * Payload for undoing batch creation (delete all created cards)
 */
export interface BatchCreateUndoPayload {
	type: "batch-create";
	cardIds: string[];
}

/**
 * Union type for all undo payloads
 */
export type UndoPayload =
	| CreateUndoPayload
	| UpdateUndoPayload
	| DeleteUndoPayload
	| BatchCreateUndoPayload;

/**
 * Single undo stack entry
 */
export interface UndoEntry {
	/** Unique ID for this undo entry */
	id: string;
	/** Type of action that was performed */
	actionType: UndoActionType;
	/** Human-readable description for notification */
	description: string;
	/** Timestamp when action was performed */
	timestamp: number;
	/** Data needed to reverse the action */
	payload: UndoPayload;
}
