import type { Command, CommandHook } from "../command.types";
import type { ReviewAnswerCommand } from "../commands/review-answer.cmd";

interface ReviewUndoCallbacks {
	onUpdateSchedulingPreview: () => void;
}

export class ReviewUndoHook implements CommandHook {
	constructor(private callbacks: ReviewUndoCallbacks) {}

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
		command.restoreSessionState();
	}
}
