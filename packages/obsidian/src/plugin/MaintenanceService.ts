import type { App } from "obsidian";

import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type TrueRecallPlugin from "../main";

/**
 * Database housekeeping that has no home in the review UI.
 *
 * Deleting a card soft deletes the card only: the note stays behind with no
 * cards under it, and `daily_stats` keeps counting reviews whose cards are
 * gone. The integrity check cannot report either — every row still points at a
 * live row — so both are fixed on demand, in one pass, the way the card was
 * deleted: remove the empty notes, then recompute the derived statistics.
 */
export class MaintenanceService {
	constructor(private readonly plugin: TrueRecallPlugin) {}

	private get app(): App {
		return this.plugin.app;
	}

	async cleanupOrphanNotes(): Promise<void> {
		const { notes } = this.plugin.cardStore;
		const orphanIds = notes.findOrphanIds();

		const confirmed = await confirm(this.app, {
			title: "Clean up orphan notes",
			message:
				orphanIds.length > 0
					? `${orphanIds.length} note${orphanIds.length === 1 ? "" : "s"} no longer have any card and will be removed. The statistics are then rebuilt from the review history. Only note rows are soft deleted; the cards and their review history are already gone.`
					: "No orphan notes found. Rebuild the statistics from the review history instead?",
			confirmLabel: orphanIds.length > 0 ? "Remove and rebuild" : "Rebuild",
		});
		if (!confirmed) return;

		for (const id of orphanIds) notes.delete(id);
		this.rebuildStatistics();

		const removed = orphanIds.length
			? `Removed ${orphanIds.length} orphan note${orphanIds.length === 1 ? "" : "s"}`
			: "No orphan notes";
		notify().success(`${removed} · statistics rebuilt`);
	}

	/**
	 * `daily_stats` is derived from `review_log`, so it only needs recomputing.
	 * The Statistics view keeps its own cache and shows the new numbers when it
	 * is reopened.
	 */
	private rebuildStatistics(): void {
		this.plugin.cardStore.stats.rebuildDailyStatsFromReviewLog(
			this.plugin.settings.dayStartHour,
		);
	}
}
