import type { ReviewApi } from "@true-recall/obsidian/store";
import type { Command, CommandHook } from "../command.types";

export interface ReviewCommandData {
	previousIndex: number;
}

export interface ReviewUndoCallbacks {
	onUpdateSchedulingPreview: () => void;
	onUndoAnswer: (command: Command, writeCancelled: boolean) => void;
}

export class ReviewUndoHook implements CommandHook {
	private snapshots = new WeakMap<Command, ReviewCommandData>();

	constructor(
		private getReview: () => ReviewApi,
		private callbacks: ReviewUndoCallbacks,
	) {}

	afterExecute(command: Command): void {
		if (!isReviewCommand(command)) return;

		this.snapshots.set(command, {
			previousIndex: this.getReview().currentIndex,
		});
	}

	beforeUndo(command: Command): void {
		if (!isReviewCommand(command)) return;

		const type = command.type;

		if (type === "review:answer") {
			const writeCancelled = command.cancelPendingWrite?.() ?? false;
			this.callbacks.onUndoAnswer(command, writeCancelled);
		}

		if (
			type === "review:bury" ||
			type === "review:suspend" ||
			type === "review:forget"
		) {
			// Queue restoration is handled inside the command's undo()
			// which calls insertCardAtPosition via the getReview callback
		}

		this.callbacks.onUpdateSchedulingPreview();
	}
}

function isReviewCommand(command: Command): boolean {
	return command.type.startsWith("review:");
}
