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

interface CapturedSibling {
	card: FSRSFlashcardItem;
	originalFsrs: FSRSCardData;
	position: number;
}

abstract class BaseReviewActionCommand implements Command {
	abstract readonly type: string;
	abstract readonly mutationType: MutationType;
	readonly description: string;
	readonly deferred = true;

	protected writeExecuted = false;
	protected pendingTimeoutId: number | null = null;
	protected params: ReviewActionParams;

	private capturedSiblings: CapturedSibling[] = [];

	constructor(params: ReviewActionParams, description: string) {
		this.params = params;
		this.description = description;
	}

	protected abstract doWrite(ctx: CommandContext): void;

	execute(ctx: CommandContext): void {
		const review = this.params.getReview();
		const queue = review.queue;
		const queueIndexById = new Map<string, number>();
		for (let i = 0; i < queue.length; i++) {
			const card = queue[i];
			if (card) queueIndexById.set(card.id, i);
		}

		// Snapshot sibling cards (excluding the primary) that are actually in
		// the queue, so undo can restore both their FSRS and their queue slot.
		this.capturedSiblings = [];
		for (const id of this.params.siblingIds) {
			if (id === this.params.card.id) continue;
			const idx = queueIndexById.get(id);
			if (idx === undefined) continue;
			const found = queue[idx];
			if (!found) continue;
			this.capturedSiblings.push({
				card: { ...found },
				originalFsrs: { ...found.fsrs },
				position: idx,
			});
		}

		review.removeCardsByIds(this.params.siblingIds);

		this.pendingTimeoutId = window.setTimeout(() => {
			this.writeExecuted = true;
			this.pendingTimeoutId = null;
			try {
				this.doWrite(ctx);
				// doWrite must use { skipNotification: true } on every FSRS
				// write so the domain-event bus does not set lastMutation —
				// otherwise ReviewView's signal effect would race the queue
				// we already updated synchronously above. We still need
				// DataLayer queries (panel, dashboard, counts) refreshed, so
				// emit a manual invalidation here. mutate() only invalidates
				// query groups and does not flow through the event bus.
				mutate(this.mutationType, () => {});
			} catch (error) {
				console.error(`[${this.type}] Error in deferred write:`, error);
			}
		}, 0);
	}

	cancelPendingWrite(): boolean {
		if (!this.writeExecuted && this.pendingTimeoutId !== null) {
			window.clearTimeout(this.pendingTimeoutId);
			this.pendingTimeoutId = null;
			return true;
		}
		return false;
	}

	undo(ctx: CommandContext): void {
		const cancelled = this.cancelPendingWrite();
		const p = this.params;

		// Re-insert primary + captured siblings in ascending order of their
		// original positions so each splice puts the card at its original index.
		// Restore the queue BEFORE any DB writes — otherwise the card:updated
		// domain event would fire setLastMutation, the ReviewView effect would
		// run rebuildActiveSession against stale Q.ALL_META, and the manual
		// restoration below would race with the rebuild's replaceQueue.
		const restorations = [
			{
				card: { ...p.card, fsrs: p.originalFsrs },
				position: p.previousIndex,
			},
			...this.capturedSiblings.map((s) => ({
				card: { ...s.card, fsrs: s.originalFsrs },
				position: s.position,
			})),
		].sort((a, b) => a.position - b.position);

		const review = p.getReview();
		const newQueue = [...review.queue];
		for (const r of restorations) {
			const clamped = Math.max(0, Math.min(r.position, newQueue.length));
			newQueue.splice(clamped, 0, r.card);
		}
		review.replaceQueue(newQueue, p.card.id);

		if (!cancelled) {
			// skipNotification: true keeps lastMutation untouched so the
			// ReviewView effect does not fire a redundant rebuildActiveSession
			// over the queue we just restored above. We still need DataLayer
			// queries (counts, panel, dashboard) refreshed, so emit a manual
			// invalidation through mutate(); mutate() only invalidates groups
			// and does not flow through the domain-event bus.
			ctx.flashcardManager.updateCardFSRS(
				p.card.id,
				p.originalFsrs,
				undefined,
				{ skipNotification: true },
			);
			for (const sibling of this.capturedSiblings) {
				ctx.flashcardManager.updateCardFSRS(
					sibling.card.id,
					sibling.originalFsrs,
					undefined,
					{ skipNotification: true },
				);
			}
			mutate(this.mutationType, () => {});
		}
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
				ctx.flashcardManager.updateCardFSRS(
					id,
					{ ...data, suspended: true },
					undefined,
					{ skipNotification: true },
				);
			}
		}
	}
}

export class ReviewBuryCommand extends BaseReviewActionCommand {
	readonly type = "review:bury";
	readonly mutationType = "card:buried" as const;

	constructor(
		params: ReviewActionParams,
		private buriedUntil: string,
	) {
		const n = params.siblingIds.length;
		super(params, n > 1 ? `Bury ${n} cards` : "Bury card");
	}

	protected doWrite(ctx: CommandContext): void {
		for (const id of this.params.siblingIds) {
			const data = ctx.cardStore.get(id);
			if (data) {
				ctx.flashcardManager.updateCardFSRS(
					id,
					{ ...data, buriedUntil: this.buriedUntil },
					undefined,
					{ skipNotification: true },
				);
			}
		}
	}
}

export class ReviewForgetCommand extends BaseReviewActionCommand {
	readonly type = "review:forget";
	readonly mutationType = "card:reset" as const;

	private reviewedTodayIds: string[] = [];
	private reviewedTodayDate: string | null = null;

	constructor(params: ReviewActionParams) {
		const n = params.siblingIds.length;
		super(params, n > 1 ? `Forget ${n} cards` : "Forget card");
	}

	protected doWrite(ctx: CommandContext): void {
		// Capture which sibling ids were marked reviewed today *before*
		// removeReviewedCards wipes them, so undo restores exactly that set.
		const today = ctx.sessionPersistence.getTodayKey();
		const reviewedToday = new Set(
			ctx.cardStore.stats.getReviewedCardIds(today),
		);
		this.reviewedTodayDate = today;
		this.reviewedTodayIds = this.params.siblingIds.filter((id) =>
			reviewedToday.has(id),
		);

		ctx.cardStore.cards.bulkForget(this.params.siblingIds);
		ctx.sessionPersistence?.removeReviewedCards(this.params.siblingIds);
		mutate("cards:bulk", () => {});
	}

	override undo(ctx: CommandContext): void {
		// Base class restores FSRS + queue position for primary AND siblings.
		super.undo(ctx);

		// Restore daily_reviewed_cards rows wiped by bulkForget — only for ids
		// that were actually present before, so we never invent fake entries.
		if (this.reviewedTodayDate) {
			for (const id of this.reviewedTodayIds) {
				ctx.cardStore.stats.recordReviewedCard(this.reviewedTodayDate, id);
			}
		}
	}
}
