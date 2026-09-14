import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { CsvExportModal } from "@true-recall/obsidian/modals/integration/CsvExportModal";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { AnkiExportModal } from "@true-recall/plugins/anki-import-export/AnkiExportModal";
import { AnkiImportModal } from "@true-recall/plugins/anki-import-export/AnkiImportModal";

export class ImportExportCoordinator {
	constructor(private plugin: TrueRecallPlugin) {}

	async importAnki(): Promise<void> {
		if (!this.plugin.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		// Safety backup before import (like Anki does)
		try {
			await this.plugin.backupService?.createBackup();
		} catch {
			console.warn("[True Recall] Pre-import backup failed, proceeding anyway");
		}

		const modal = new AnkiImportModal(
			this.plugin.app,
			this.plugin.cardStore,
			this.plugin.fsrsService,
			() => this.plugin.settings,
		);
		modal.open();
	}

	exportAnki(): void {
		if (!this.plugin.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const modal = new AnkiExportModal(
			this.plugin.app,
			this.plugin.cardStore,
			this.plugin.fsrsService,
		);
		modal.open();
	}

	exportCsv(): void {
		if (!this.plugin.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const modal = new CsvExportModal(this.plugin.app, this.plugin.cardStore);
		modal.open();
	}
}
