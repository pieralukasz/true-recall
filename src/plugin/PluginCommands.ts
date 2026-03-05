import { migrateLegacyProjects } from "@features/core/services/migrate-projects";
import { migrateVault } from "@features/study/services/flashcard/migration.service";
import type TrueRecallPlugin from "../main";
import { Notice } from "obsidian";

export function registerCommands(plugin: TrueRecallPlugin): void {
	plugin.addCommand({
		id: "open-flashcard-panel",
		name: "Open flashcard panel",
		callback: () => void plugin.activateView(),
	});

	plugin.addCommand({
		id: "review-current-note",
		name: "Review flashcards from current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.reviewCurrentNote();
				}
				return true;
			}
			return false;
		},
	});

	plugin.addCommand({
		id: "review-todays-cards",
		name: "Review today's new cards",
		callback: () => void plugin.reviewTodaysCards(),
	});

	plugin.addCommand({
		id: "open-dashboard",
		name: "Open dashboard",
		callback: () => void plugin.openDashboard(),
	});

	plugin.addCommand({
		id: "open-card-browser",
		name: "Open card browser",
		callback: () => void plugin.openCardBrowser(),
	});

	plugin.addCommand({
		id: "open-statistics",
		name: "Open statistics panel",
		callback: () => void plugin.openStatsView(),
	});

	plugin.addCommand({
		id: "open-fsrs-simulator",
		name: "Open FSRS simulator",
		callback: () => void plugin.openSimulator(),
	});

	plugin.addCommand({
		id: "manage-note-types",
		name: "Manage note types",
		callback: () => plugin.openCardTypesEditor(),
	});

	plugin.addCommand({
		id: "add-flashcards",
		name: "Import flashcards",
		callback: () => plugin.openImportStudio(),
	});

	plugin.addCommand({
		id: "create-backup",
		name: "Create database backup",
		callback: () => void plugin.createManualBackup(),
	});

	// Cloud sync - coming soon
	// plugin.addCommand({
	// 	id: "sync-cloud",
	// 	name: "Sync cloud data",
	// 	callback: () => void plugin.syncCloud(),
	// });

	plugin.addCommand({
		id: "add-flashcard-uid",
		name: "Add flashcard uid to current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.addFlashcardUidToCurrentNote();
				}
				return true;
			}
			return false;
		},
	});

	plugin.addCommand({
		id: "undo-flashcard-action",
		name: "Undo last flashcard action",
		checkCallback: (checking) => {
			if (!plugin.undoService?.canUndo()) {
				return false;
			}
			if (!checking) {
				void plugin.undoService.undo();
			}
			return true;
		},
	});

	plugin.addCommand({
		id: "import-anki",
		name: "Import Anki deck (.apkg)",
		callback: () => void plugin.importAnki(),
	});

	plugin.addCommand({
		id: "export-anki",
		name: "Export to Anki (.apkg)",
		callback: () => void plugin.exportAnki(),
	});

	plugin.addCommand({
		id: "export-csv",
		name: "Export as CSV/TSV",
		callback: () => void plugin.exportCsv(),
	});

	plugin.addCommand({
		id: "insert-project-dashboard",
		name: "Insert project dashboard",
		editorCheckCallback: (checking, editor) => {
			if (checking) return true;

			editor.replaceSelection("```true-recall-project\n```\n");
			return true;
		},
	});

	plugin.addCommand({
		id: "create-master-dashboard",
		name: "Create master dashboard note",
		callback: () => void plugin.createMasterDashboard(),
	});

	plugin.addCommand({
		id: "set-fsrs-preset",
		name: "Set FSRS preset for current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.setFsrsPresetForCurrentNote();
				}
				return true;
			}
			return false;
		},
	});

	plugin.addCommand({
		id: "archive-current-note",
		name: "Archive current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.flashcardManager
						.getFrontmatterService()
						.setArchive(file, true);
				}
				return true;
			}
			return false;
		},
	});

	plugin.addCommand({
		id: "migrate-legacy-projects",
		name: "Migrate legacy projects to parents",
		callback: () => void migrateLegacyProjects(plugin.app),
	});

	plugin.addCommand({
		id: "migrate-inline-to-block",
		name: "Migrate flashcards to block format",
		callback: async () => {
			new Notice("Migrating flashcards to block format...");
			const result = await migrateVault(plugin.app);
			if (result.migratedFiles === 0) {
				new Notice("No inline flashcards found to migrate.");
			} else {
				new Notice(
					`Migrated ${result.migratedCards} cards in ${result.migratedFiles} files.` +
					(result.errors.length > 0 ? ` ${result.errors.length} errors.` : ""),
				);
			}
			if (result.errors.length > 0) {
				console.warn("[TrueRecall] Migration errors:", result.errors);
			}
		},
	});

	plugin.addCommand({
		id: "unarchive-current-note",
		name: "Unarchive current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && file.extension === "md") {
				if (!checking) {
					void plugin.flashcardManager
						.getFrontmatterService()
						.setArchive(file, false);
				}
				return true;
			}
			return false;
		},
	});
}
