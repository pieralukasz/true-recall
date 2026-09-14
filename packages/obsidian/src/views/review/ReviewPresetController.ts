import type { FSRSFlashcardItem, FSRSPreset } from "@true-recall/core/types";

import type { PresetPickerOption } from "@true-recall/obsidian/features/study/ui/review/components";
import type { SessionFilters } from "@true-recall/obsidian/features/study/ui/review/review.types";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { ReviewApi } from "@true-recall/obsidian/store";

import type TrueRecallPlugin from "../../main";
import type { ReviewSourceNavigator } from "./ReviewSourceNavigator";
export class ReviewPresetController {
	constructor(
		private plugin: TrueRecallPlugin,
		private presetCache: Map<string, FSRSPreset>,
		private getReview: () => ReviewApi,
		private getFilters: () => SessionFilters,
		private source: ReviewSourceNavigator,
		private updatePreview: () => void,
	) {}
	private get review() {
		return this.getReview();
	}
	private get filters() {
		return this.getFilters();
	}

	getPresetOptions(): PresetPickerOption[] {
		return this.plugin.presetService.getPresets().map((p) => ({
			value: p.name,
			label: p.name,
			retention: p.requestRetention,
		}));
	}

	cachePresetsForQueue(queue: FSRSFlashcardItem[]): void {
		this.presetCache.clear();
		for (const card of queue) {
			const uid = card.sourceUid ?? "";
			if (this.presetCache.has(uid)) continue;
			this.presetCache.set(
				uid,
				this.plugin.presetService.resolvePresetForCard(card, {
					projectPath: this.filters.projectPath,
				}),
			);
		}
	}

	handlePresetChange(newPresetName: string): void {
		const card = this.review.getCurrentCard();
		if (!card) return;

		const newPreset = this.plugin.presetService.getPresetByName(newPresetName);
		if (!newPreset) {
			notify().error(`Preset "${newPresetName}" not found`);
			return;
		}

		const sourceFile = this.source.resolveSourceFile(card);
		if (!sourceFile) {
			notify().warning("Cannot save preset: source note not found");
			return;
		}

		// Persist to frontmatter (async, fire-and-forget for UI responsiveness)
		void this.plugin.flashcardManager
			.getFrontmatterService()
			.setFsrsPreset(sourceFile.path, newPresetName);

		const uid = card.sourceUid ?? "";
		this.presetCache.set(uid, newPreset);

		// Recalculate button intervals with new preset
		this.updatePreview();

		// Force re-render so ButtonBar picks up new scheduling preview
		this.review.notifyChange();
	}
}
