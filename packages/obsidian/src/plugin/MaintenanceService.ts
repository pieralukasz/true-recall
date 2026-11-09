import type { App } from "obsidian";

import { t } from "@true-recall/obsidian/i18n";
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
			title: t("Clean up orphan notes"),
			message:
				orphanIds.length > 0
					? t(
							"Notes without any card: {0}. They will be removed and the statistics rebuilt from the review history. A backup is made first.",
							[orphanIds.length],
						)
					: t(
							"No orphan notes found. Rebuild the statistics from the review history instead?",
						),
			confirmLabel:
				orphanIds.length > 0 ? t("Remove and rebuild") : t("Rebuild"),
		});
		if (!confirmed) return;

		if (orphanIds.length > 0) {
			await this.plugin.createManualBackup();
			for (const id of orphanIds) notes.delete(id);
		}
		this.rebuildStatistics();

		notify().success(
			orphanIds.length > 0
				? t("Orphan notes removed: {0}. Statistics rebuilt.", [
						orphanIds.length,
					])
				: t("No orphan notes. Statistics rebuilt."),
		);
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
