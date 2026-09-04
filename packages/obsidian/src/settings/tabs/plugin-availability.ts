import type { TrueRecallSettings } from "@true-recall/core/types";

import { isFeatureAvailable } from "@true-recall/obsidian/plugin/plugin-utils";

import type { PluginManifest } from "@true-recall/plugins";

export function isPluginActive(
	manifest: PluginManifest,
	settings: TrueRecallSettings,
): boolean {
	return isFeatureAvailable(settings, manifest.info.id, manifest.info.tier);
}
