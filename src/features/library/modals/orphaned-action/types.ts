import type { FSRSCardData } from "../../../../shared/types";

export type OrphanedCardsAction =
	| "delete"
	| "move"
	| "create_note"
	| "leave_orphaned";

export interface OrphanedCardsActionResult {
	cancelled: boolean;
	action: OrphanedCardsAction;
	targetNotePath?: string;
	newNotePath?: string;
}

export interface OrphanedCardsActionModalOptions {
	cards: FSRSCardData[];
	deletedNoteName: string;
	sourceUid: string;
}
