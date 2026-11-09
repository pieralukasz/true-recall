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
 * back; the graduated children stay suspended with their history.
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
		// The review view saves answers without `card:reviewed`.
		const offRecorded = this.plugin.coreApp.events.on(
			"review:recorded",
			(payload: { cardId: string }) => {
				void this.onReviewed(payload.cardId);
			},
		);
		if (typeof offRecorded === "function") this.plugin.register(offRecorded);

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
	 * and the suspended parent, so settle every open group on load. With the
	 * feature switched off, open groups are dissolved and parents come back.
	 */
	private repairStrandedParents(): void {
		const store = this.plugin.cardStore;
		for (const parentId of store.childCards.getParentIds()) {
			if (this.plugin.settings.childCardsEnabled) this.settle(parentId);
			else this.restoreParent(parentId);
		}
	}

	private onRemoved(cardId: string): void {
		const store = this.plugin.cardStore;
		const parentId = store.childCards.getParentId(cardId);
		if (!parentId) return;

		// Read before unlinking: the removed child may be the group's last link.
		const ownsSuspension =
			store.childCards.isParentSuspendedByChildren(parentId);
		store.childCards.unlink(cardId);
		this.settle(parentId, ownsSuspension);
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
		this.settle(parentId);
	}

	/**
	 * Restore the parent once no child is left open: every live child graduated,
	 * or none is alive any more. Graduated children stay suspended, so their
	 * review history keeps counting in the statistics.
	 */
	private settle(parentId: string, ownsSuspension?: boolean): void {
		const children = this.plugin.cardStore.childCards.getLiveChildren(parentId);
		if (children.some((child) => child.graduatedAt === null)) return;
		const restored = this.restoreParent(parentId, ownsSuspension);
		if (children.length > 0) {
			notify().success(
				restored
					? t("Child cards graduated, parent restored")
					: t("Child cards graduated, the parent stays suspended"),
			);
		}
	}

	/**
	 * Close the group and unsuspend the parent, but only when the child cards
	 * suspended it: a parent the user had suspended before stays suspended.
	 */
	private restoreParent(parentId: string, ownsSuspension?: boolean): boolean {
		const store = this.plugin.cardStore;
		const restore =
			ownsSuspension ?? store.childCards.isParentSuspendedByChildren(parentId);
		if (restore) store.cards.bulkUnsuspend([parentId]);
		store.childCards.unlinkParent(parentId);
		this.plugin.dataLayer?.invalidateGroups([
			G.CARDS,
			G.BROWSER,
			G.DASHBOARD,
			G.REVIEW,
			G.PANEL,
		]);
		return restore;
	}
}
