/**
 * Platform adapter for prompting the user when a flashcard_uid is removed.
 * Obsidian: shows a modal dialog
 * Desktop: shows a native dialog or inline prompt
 */

export interface UidChangeEvent {
	path: string;
	removedUid: string;
	cardCount: number;
	fileName: string;
}

export type UidRemovalAction =
	| { action: "restore" }
	| { action: "delete" }
	| { action: "move"; targetNotePath: string }
	| { action: "cancelled" };

export interface IUidRemovalPrompt {
	onUidRemoved(event: UidChangeEvent): Promise<UidRemovalAction>;
}
