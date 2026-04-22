import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

import { notify } from "@true-recall/obsidian/services/notification.service";

import type TrueRecallPlugin from "../main";

export function isPresetProRequired(preset: GenerationPreset): boolean {
	return preset.requiresPro || preset.tts !== null || preset.image !== null;
}

export function runPresetPostProcessing(
	_plugin: TrueRecallPlugin,
	preset: GenerationPreset,
	createdCardIds: string[],
): void {
	if (createdCardIds.length === 0) return;

	if (preset.tts?.field || preset.image) {
		notify().info("Audio and image generation — coming soon.");
	}
}
