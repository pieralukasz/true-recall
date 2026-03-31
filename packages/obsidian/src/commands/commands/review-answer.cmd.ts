import type { FSRSCardData, FSRSFlashcardItem } from "@true-recall/core/types";
import { mutate } from "@true-recall/obsidian/data";
import type { Command, CommandContext } from "../command.types";

export interface ReviewAnswerParams {
	card: FSRSFlashcardItem;
	originalFsrs: FSRSCardData;
	updatedFsrs: FSRSCardData;
	previousIndex: number;
	wasNewCard: boolean;
	rating: number;
	previousState: number;
	scheduledDays: number;
	elapsedDays: number;
	responseTime: number;
	presetName: string;
	requeuedAtIndex?: number;
	buriedSiblingIds?: string[];
	buriedSiblings?: FSRSFlashcardItem[];
	skipNotification?: boolean;
}

export class ReviewAnswerCommand implements Command {
	readonly type = "review:answer";
	readonly mutationType = "card:reviewed" as const;
	readonly deferred = true;
	readonly description: string;

	readonly params: ReviewAnswerParams;
	private writeExecuted = false;
	private pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

	constructor(params: ReviewAnswerParams) {
		const { Rating } = require("ts-fsrs") as typeof import("ts-fsrs");
		this.description = `Review (${Rating[params.rating]})`;
		this.params = params;
	}

	execute(ctx: CommandContext): void {
		this.pendingTimeoutId = setTimeout(() => {
			this.writeExecuted = true;
			this.pendingTimeoutId = null;

			const p = this.params;
			const persisted = ctx.flashcardManager.updateCardFSRS(
				p.card.id,
				p.updatedFsrs,
				undefined,
				{ skipNotification: true },
			);

			if (!persisted) return;

			try {
				ctx.sessionPersistence.recordReview(
					p.card.id,
					p.wasNewCard,
					p.responseTime,
					p.rating,
					p.previousState,
					p.scheduledDays,
					p.elapsedDays,
					p.presetName,
				);
			} catch (error) {
				console.error("Error recording review to persistent storage:", error);
			}

			mutate("card:reviewed", () => {});
		}, 0);
	}

	cancelPendingWrite(): boolean {
		if (!this.writeExecuted && this.pendingTimeoutId !== null) {
			clearTimeout(this.pendingTimeoutId);
			this.pendingTimeoutId = null;
			return true;
		}
		return false;
	}

	undo(ctx: CommandContext): void {
		const cancelled = this.cancelPendingWrite();
		const p = this.params;

		if (!cancelled) {
			ctx.flashcardManager.updateCardFSRS(p.card.id, p.originalFsrs);
			ctx.sessionPersistence.removeLastReview(
				p.card.id,
				p.wasNewCard,
				p.rating,
				p.previousState,
			);
			mutate("card:reviewed", () => {});
		}
	}
}
