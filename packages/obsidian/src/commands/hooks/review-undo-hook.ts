import type { ReviewApi } from "@true-recall/obsidian/store";

import type { Command, CommandHook } from "../command.types";
import type { ReviewAnswerCommand } from "../commands/review-answer.cmd";

interface ReviewUndoCallbacks {
	onUpdateSchedulingPreview: () => void;
}

export class ReviewUndoHook implements CommandHook {
	constructor(
		private getReview: () => ReviewApi,
		private callbacks: ReviewUndoCallbacks,
	) {}

	beforeUndo(command: Command): void {
		if (!command.type.startsWith("review:")) return;

		if (command.type === "review:answer") {
			this.undoAnswer(command as ReviewAnswerCommand);
		}

		// review:bury, review:suspend, review:forget handle their own
		// queue restoration in their undo() method via getReview()

		this.callbacks.onUpdateSchedulingPreview();
	}

	private undoAnswer(command: ReviewAnswerCommand): void {
		const p = command.params;
		// previousIndex === null ⇒ standalone grade (e.g. card preview modal); nothing to restore.
		if (p.previousIndex === null) return;

		const review = this.getReview();

		// Restore buried siblings back into the queue
		if (p.buriedSiblings && p.buriedSiblings.length > 0) {
			for (const sibling of p.buriedSiblings) {
				review.insertCardAtPosition(sibling, review.queue.length);
			}
		}

		// Restore the answered card at its original queue position
		review.undoLastAnswer(
			p.previousIndex,
			{ ...p.card, fsrs: p.originalFsrs },
			p.requeuedAtIndex,
		);
	}
}
