import type { FSRSCardData, FSRSFlashcardItem } from "@true-recall/core/types";

import { mutate } from "@true-recall/obsidian/data";
import type { MutationType } from "@true-recall/obsidian/data/queries";
import type { ReviewApi } from "@true-recall/obsidian/store";

import type { Command, CommandContext } from "../command.types";

interface ReviewActionParams {
	card: FSRSFlashcardItem;
	originalFsrs: FSRSCardData;
	previousIndex: number;
	siblingIds: string[];
	getReview: () => ReviewApi;
}

abstract class BaseReviewActionCommand implements Command {
	abstract readonly type: string;
	abstract readonly mutationType: MutationType;
	readonly description: string;
	readonly deferred = true;

	protected writeExecuted = false;
	protected pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;
	protected params: ReviewActionParams;

	constructor(params: ReviewActionParams, description: string) {
		this.params = params;
		this.description = description;
	}

	protected abstract doWrite(ctx: CommandContext): void;

	execute(ctx: CommandContext): void {
		const review = this.params.getReview();

		for (const id of this.params.siblingIds) {
			review.removeCardById(id);
		}

		this.pendingTimeoutId = setTimeout(() => {
			this.writeExecuted = true;
			this.pendingTimeoutId = null;
			try {
				this.doWrite(ctx);
			} catch (error) {
				console.error(`[${this.type}] Error in deferred write:`, error);
			}
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
		}

		p.getReview().insertCardAtPosition(
			{ ...p.card, fsrs: p.originalFsrs },
			p.previousIndex,
		);
	}
}

export class ReviewSuspendCommand extends BaseReviewActionCommand {
	readonly type = "review:suspend";
	readonly mutationType = "card:suspended" as const;

	constructor(params: ReviewActionParams) {
		const n = params.siblingIds.length;
		super(params, n > 1 ? `Suspend ${n} cards` : "Suspend card");
	}

	protected doWrite(ctx: CommandContext): void {
		for (const id of this.params.siblingIds) {
			const data = ctx.cardStore.get(id);
			if (data) {
				ctx.flashcardManager.updateCardFSRS(id, { ...data, suspended: true });
			}
		}
	}
}

export class ReviewBuryCommand extends BaseReviewActionCommand {
	readonly type = "review:bury";
	readonly mutationType = "card:buried" as const;

	private additionalCards?: Array<{
		card: FSRSFlashcardItem;
		originalFsrs: FSRSCardData;
	}>;

	constructor(
		params: ReviewActionParams,
		private buriedUntil: string,
		additionalCards?: Array<{
			card: FSRSFlashcardItem;
			originalFsrs: FSRSCardData;
		}>,
	) {
		const n = params.siblingIds.length;
		super(params, n > 1 ? `Bury ${n} cards` : "Bury card");
		this.additionalCards = additionalCards;
	}

	protected doWrite(ctx: CommandContext): void {
		for (const id of this.params.siblingIds) {
			const data = ctx.cardStore.get(id);
			if (data) {
				ctx.flashcardManager.updateCardFSRS(id, {
					...data,
					buriedUntil: this.buriedUntil,
				});
			}
		}
	}

	override undo(ctx: CommandContext): void {
		const cancelled = this.cancelPendingWrite();
		const p = this.params;

		if (!cancelled) {
			ctx.flashcardManager.updateCardFSRS(p.card.id, p.originalFsrs);
			if (this.additionalCards) {
				for (const ac of this.additionalCards) {
					ctx.flashcardManager.updateCardFSRS(ac.card.id, ac.originalFsrs);
				}
			}
		}

		p.getReview().insertCardAtPosition(
			{ ...p.card, fsrs: p.originalFsrs },
			p.previousIndex,
		);
	}
}

export class ReviewForgetCommand extends BaseReviewActionCommand {
	readonly type = "review:forget";
	readonly mutationType = "card:reset" as const;

	constructor(params: ReviewActionParams) {
		const n = params.siblingIds.length;
		super(params, n > 1 ? `Forget ${n} cards` : "Forget card");
	}

	protected doWrite(ctx: CommandContext): void {
		ctx.cardStore.cards.bulkForget(this.params.siblingIds);
		ctx.sessionPersistence?.removeReviewedCards(this.params.siblingIds);
		mutate("cards:bulk", () => {});
	}

	override undo(ctx: CommandContext): void {
		const cancelled = this.cancelPendingWrite();
		const p = this.params;

		if (!cancelled) {
			ctx.flashcardManager.updateCardFSRS(p.card.id, p.originalFsrs);
		}

		p.getReview().insertCardAtPosition(
			{ ...p.card, fsrs: p.originalFsrs },
			p.previousIndex,
		);

		// Re-add to daily_reviewed_cards
		const today = ctx.sessionPersistence.getTodayKey();
		ctx.cardStore.stats.recordReviewedCard(today, p.card.id);
	}
}
