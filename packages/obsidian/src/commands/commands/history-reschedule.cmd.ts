import type { FSRSCardData } from "@true-recall/core/types";

import type { Command, CommandContext } from "../command.types";

interface HistoryRescheduleUndoEntry {
	cardId: string;
	before: FSRSCardData;
	after: FSRSCardData;
}

/**
 * Undo entry for "reschedule from history". Unlike FSRSHelperCommand it
 * restores the full memory state (stability, difficulty, reps...), not only
 * the due date, because the reschedule rewrote all of it. A card answered
 * after the reschedule keeps its newer state.
 */
export class HistoryRescheduleCommand implements Command {
	readonly type = "card:history-reschedule";
	readonly mutationType = "cards:bulk" as const;

	constructor(
		readonly description: string,
		private changes: HistoryRescheduleUndoEntry[],
	) {}

	execute(_ctx: CommandContext): void {
		// Already written by HistoryRescheduleService before this is recorded.
	}

	undo(ctx: CommandContext): void {
		ctx.cardStore.transaction(() => {
			for (const change of this.changes) {
				const current = ctx.cardStore.cards.get(change.cardId);
				if (
					!current ||
					current.due !== change.after.due ||
					current.lastReview !== change.after.lastReview
				) {
					continue;
				}
				ctx.cardStore.cards.applyReplayedScheduling(
					change.cardId,
					change.before,
				);
			}
		});
	}
}
