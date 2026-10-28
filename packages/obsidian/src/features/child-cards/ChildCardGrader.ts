import { G } from "@true-recall/obsidian/data/queries";
import { t } from "@true-recall/obsidian/i18n";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { isGraduatable } from "./child-graduation";

/**
 * Graduates child cards as they are reviewed.
 *
 * A child that reaches the configured Good streak is suspended, so it stops
 * asking. Once every live child of a parent has graduated, the parent comes
 * back and the children are deleted — that is the whole point of the pair.
 */
export class ChildCardGrader {
	constructor(private readonly plugin: TrueRecallPlugin) {}

	attach(): void {
		const off = this.plugin.coreApp.events.on(
			"card:reviewed",
			(payload: { cardId: string }) => {
				void this.onReviewed(payload.cardId);
			},
		);
		if (typeof off === "function") this.plugin.register(off);

		// Undo (Ctrl+Z) and manual deletes remove the child card, not the link.
		// Without this the parent would stay suspended with no children left.
		const offRemoved = this.plugin.coreApp.events.on(
			"card:removed",
			(payload: { cardIds?: string[]; cardId?: string }) => {
				const ids =
					payload?.cardIds ?? (payload?.cardId ? [payload.cardId] : []);
				for (const cardId of ids) this.onRemoved(cardId);
			},
		);
		if (typeof offRemoved === "function") this.plugin.register(offRemoved);

		this.repairStrandedParents();
	}

	/**
	 * Undoing the creation (Ctrl+Z) deletes the child card but leaves the link
	 * and the suspended parent. Nothing listens to that removal, so repair on
	 * load: a parent with no live child left is un-suspended again.
	 */
	private repairStrandedParents(): void {
		if (!this.plugin.settings.childCardsEnabled) return;
		const store = this.plugin.cardStore;
		for (const parentId of store.childCards.getParentIds()) {
			if (store.childCards.getLiveChildren(parentId).length > 0) continue;
			const parent = store.cards.getByIds([parentId])[0];
			if (parent?.suspended) store.cards.bulkUnsuspend([parentId]);
		}
	}

	private onRemoved(cardId: string): void {
		if (!this.plugin.settings.childCardsEnabled) return;
		const store = this.plugin.cardStore;
		const parentId = store.childCards.getParentId(cardId);
		if (!parentId) return;

		store.childCards.unlink(cardId);
		if (store.childCards.getLiveChildren(parentId).length === 0) {
			store.cards.bulkUnsuspend([parentId]);
		}
	}

	private async onReviewed(cardId: string): Promise<void> {
		if (!this.plugin.settings.childCardsEnabled) return;

		const store = this.plugin.cardStore;
		const parentId = store.childCards.getParentId(cardId);
		if (!parentId) return;

		const streak = this.plugin.settings.childGoodStreak;
		const ratings = store.stats
			.getCardReviewHistory(cardId, streak)
			.map((entry) => entry.r);
		if (!isGraduatable(ratings, streak)) return;

		store.childCards.markGraduated(cardId);
		store.cards.bulkSuspend([cardId]);
		this.finishGroup(parentId);
	}

	/** Restore the parent and delete the children once the whole group is done. */
	private finishGroup(parentId: string): void {
		const store = this.plugin.cardStore;
		const children = store.childCards.getLiveChildren(parentId);
		if (children.length === 0) return;
		if (children.some((child) => child.graduatedAt === null)) return;

		store.cards.bulkUnsuspend([parentId]);
		for (const child of children) {
			store.cards.softDeleteWithCascade(child.childCardId);
		}
		this.plugin.dataLayer?.invalidateGroups([
			G.CARDS,
			G.BROWSER,
			G.DASHBOARD,
			G.REVIEW,
			G.PANEL,
		]);
		notify().success(t("Child cards graduated, parent restored"));
	}
}
