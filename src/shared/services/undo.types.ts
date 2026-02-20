/**
 * Undo Service Types
 * Type definitions for the undo/redo system
 */

import type { Grade, State } from "ts-fsrs";
import type { FSRSCardData, FSRSFlashcardItem } from "@shared/types";

/**
 * Types of operations that can be undone
 */
export type UndoActionType =
	| "create-flashcard"
	| "update-card"
	| "delete-flashcard"
	| "save-flashcards"
	| "answer"
	| "bury"
	| "suspend"
	| "fsrs-helper-operation";

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
 * Payload for undoing a review answer (restore FSRS state and re-queue card)
 */
export interface AnswerUndoPayload {
	type: "answer";
	/** Full card data to restore */
	card: FSRSFlashcardItem;
	/** Original FSRS state before the answer */
	originalFsrs: FSRSCardData;
	/** Position in queue before answering */
	previousIndex: number;
	/** Whether this was a new card */
	wasNewCard?: boolean;
	/** Rating that was given */
	rating?: Grade;
	/** FSRS state before the answer */
	previousState?: State;
	/** Position where card was requeued (for learning cards) - needs cleanup on undo */
	requeuedAtIndex?: number;
}

/**
 * Payload for undoing a bury action (restore card and remove buriedUntil)
 */
export interface BuryUndoPayload {
	type: "bury";
	/** Full card data to restore */
	card: FSRSFlashcardItem;
	/** Original FSRS state before bury */
	originalFsrs: FSRSCardData;
	/** Position in queue before bury */
	previousIndex: number;
	/** Additional cards if "bury note" was used */
	additionalCards?: Array<{
		card: FSRSFlashcardItem;
		originalFsrs: FSRSCardData;
	}>;
}

/**
 * Payload for undoing a suspend action (restore card and remove suspended flag)
 */
export interface SuspendUndoPayload {
	type: "suspend";
	/** Full card data to restore */
	card: FSRSFlashcardItem;
	/** Original FSRS state before suspend */
	originalFsrs: FSRSCardData;
	/** Position in queue before suspend */
	previousIndex: number;
}

/**
 * FSRS Helper operation types that can be undone
 */
export type FSRSHelperOperationType =
	| "balance-workload"
	| "apply-easy-days"
	| "shift-due-dates"
	| "flatten-date"
	| "disperse-siblings"
	| "schedule-break"
	| "reschedule-cards";

/**
 * Payload for undoing FSRS Helper bulk scheduling operations
 */
export interface FSRSHelperUndoPayload {
	type: "fsrs-helper-operation";
	/** Which FSRS Helper operation was performed */
	operation: FSRSHelperOperationType;
	/** Card changes to reverse */
	changes: Array<{
		cardId: string;
		originalDue: string;
		newDue: string;
	}>;
}

/**
 * Union type for all undo payloads
 */
export type UndoPayload =
	| CreateUndoPayload
	| UpdateUndoPayload
	| DeleteUndoPayload
	| BatchCreateUndoPayload
	| AnswerUndoPayload
	| BuryUndoPayload
	| SuspendUndoPayload
	| FSRSHelperUndoPayload;

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
	/** Cancel a deferred DB write. Returns true if cancelled (write never happened). */
	cancelPendingWrite?: () => boolean;
}
