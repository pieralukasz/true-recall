import type { TFile } from "obsidian";

import { G } from "@true-recall/obsidian/data";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { PresetInspectorModal } from "@true-recall/obsidian/modals/shared";
import { notify } from "@true-recall/obsidian/services/notification.service";

export class NoteActions {
	constructor(private plugin: TrueRecallPlugin) {}

	// Init methods extracted to plugin/PluginInitializers.ts
	// handleImageOcclusion extracted to plugin/PluginInitializers.ts

	async createMasterDashboard(): Promise<void> {
		const fileName = "True Recall Dashboard.md";
		let file = this.plugin.app.vault.getAbstractFileByPath(fileName);

		if (!file) {
			const content = [
				"---",
				"cssclasses:",
				"  - true-recall-dashboard-note",
				"---",
				"",
				"# True Recall Dashboard",
				"",
				"## Today",
				"",
				"```true-recall-dashboard",
				"```",
				"",
				"## Streak",
				"",
				"```true-recall-streak",
				"showWeekDots: true",
				"showTodayRate: true",
				"```",
				"",
				"## Activity",
				"",
				"```true-recall-heatmap",
				"months: 6",
				"```",
				"",
				"## Projects",
				"",
				"```true-recall-project-hub",
				"```",
				"",
				"## Workload",
				"",
				"```true-recall-workload",
				"days: 14",
				"showTime: true",
				"```",
				"",
				"## Health",
				"",
				"```true-recall-health",
				"target: 90",
				"showBuckets: true",
				"```",
				"",
			].join("\n");

			file = await this.plugin.app.vault.create(fileName, content);
		}

		await this.plugin.app.workspace.openLinkText(fileName, "", false);
	}

	async setFsrsPresetForCurrentNote(): Promise<void> {
		const file = this.plugin.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			notify().noActiveFile();
			return;
		}

		const modal = new PresetInspectorModal(
			this.plugin.app,
			this.plugin.presetService,
			file.path,
		);
		const result = await modal.openAndWait();
		if (result.action === "cancel") return;

		const frontmatterService =
			this.plugin.flashcardManager.getFrontmatterService();
		if (result.action === "set" && result.presetName) {
			await frontmatterService.setFsrsPreset(file.path, result.presetName);
			notify().success(`FSRS preset set to: ${result.presetName}`);
		} else {
			await frontmatterService.setFsrsPreset(file.path, null);
			notify().info("FSRS preset override removed");
		}
	}

	async toggleNoteReview(file?: TFile): Promise<void> {
		if (!this.plugin.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const target = file ?? this.plugin.app.workspace.getActiveFile();
		if (!target || target.extension !== "md") {
			notify().noActiveFile();
			return;
		}

		try {
			const frontmatterService =
				this.plugin.flashcardManager.getFrontmatterService();
			let sourceUid = await frontmatterService.getSourceNoteUid(target.path);

			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(target.path, sourceUid);
			}

			const hasReview = this.plugin.flashcardManager.hasNoteReview(sourceUid);
			if (hasReview) {
				this.plugin.flashcardManager.disableNoteReview(sourceUid);
				notify().success("Note review disabled");
			} else {
				this.plugin.flashcardManager.enableNoteReview(sourceUid);
				notify().success("Note review enabled");
			}

			this.plugin.dataLayer?.invalidateGroups([G.CARDS, G.DASHBOARD, G.REVIEW]);
		} catch (error) {
			notify().operationFailed("toggle note review", error);
		}
	}

	async addFlashcardUidToCurrentNote(): Promise<void> {
		const file = this.plugin.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			notify().noActiveFile();
			return;
		}

		const frontmatterService =
			this.plugin.flashcardManager.getFrontmatterService();

		const existingUid = await frontmatterService.getSourceNoteUid(file.path);
		if (existingUid) {
			notify().info(`Note already has flashcard UID: ${existingUid}`);
			return;
		}

		const newUid = frontmatterService.generateUid();
		await frontmatterService.setSourceNoteUid(file.path, newUid);

		notify().success(`Added flashcard UID: ${newUid}`);
	}
}
