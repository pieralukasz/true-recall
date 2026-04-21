import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

import { ImagePostProcessor } from "@true-recall/obsidian/services/image-post-processor";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { TTSPostProcessor } from "@true-recall/obsidian/services/tts-post-processor";

import type TrueRecallPlugin from "../main";

let ttsProcessor: TTSPostProcessor | null = null;
let imageProcessor: ImagePostProcessor | null = null;

export function getTTSPostProcessor(
	plugin: TrueRecallPlugin,
): TTSPostProcessor {
	if (!ttsProcessor) {
		ttsProcessor = new TTSPostProcessor(
			plugin.app,
			() => plugin.settings,
			plugin.cardStore,
		);
	}
	return ttsProcessor;
}

export function getImagePostProcessor(
	plugin: TrueRecallPlugin,
): ImagePostProcessor {
	if (!imageProcessor) {
		imageProcessor = new ImagePostProcessor(
			plugin.app,
			() => plugin.settings,
			plugin.cardStore,
		);
	}
	return imageProcessor;
}

export function isPresetProRequired(preset: GenerationPreset): boolean {
	return preset.requiresPro || preset.tts !== null || preset.image !== null;
}

export function runPresetPostProcessing(
	plugin: TrueRecallPlugin,
	preset: GenerationPreset,
	createdCardIds: string[],
): void {
	if (createdCardIds.length === 0) return;

	if (preset.tts?.field) {
		void getTTSPostProcessor(plugin)
			.processCards(createdCardIds, {
				ttsField: preset.tts.field,
				languageCode: preset.tts.voice,
			})
			.catch((e) => {
				console.warn("[TTSPostProcessor] processing failed", e);
				notify().warning(
					`Audio generation failed: ${e instanceof Error ? e.message : String(e)}`,
				);
			});
	}

	if (preset.image) {
		void getImagePostProcessor(plugin)
			.processCards(createdCardIds, [
				{
					fieldName: preset.image.targetField,
					sourceField: preset.image.sourceField,
					style: preset.image.style,
				},
			])
			.catch((e) => {
				console.warn("[ImagePostProcessor] processing failed", e);
				notify().warning(
					`Image generation failed: ${e instanceof Error ? e.message : String(e)}`,
				);
			});
	}
}
