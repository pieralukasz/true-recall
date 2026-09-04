import type { PluginTier } from "@true-recall/core/types";

import { aiAssistantManifest } from "./ai-assistant";
import { cardPolishManifest } from "./card-polish";
import { dashboardCodeblockManifest } from "./dashboard-codeblock";
import { imageOcclusionManifest } from "./image-occlusion";
import { linkStatusIndicatorsManifest } from "./link-status-indicators";
import { selectionToolbarManifest } from "./selection-toolbar";
import { statusBarWidgetManifest } from "./status-bar-widget";
import type { PluginManifest } from "./types";

export const PLUGIN_MANIFESTS: PluginManifest[] = [
	selectionToolbarManifest,
	linkStatusIndicatorsManifest,
	dashboardCodeblockManifest,
	statusBarWidgetManifest,
	aiAssistantManifest,
	cardPolishManifest,
];

/** Optional surfaces shown to users. Workflow families and review/data tools
 * live inside their owning feature or settings section. */
export const FEATURE_MANIFESTS: PluginManifest[] = [
	selectionToolbarManifest,
	linkStatusIndicatorsManifest,
	dashboardCodeblockManifest,
	statusBarWidgetManifest,
	aiAssistantManifest,
];

export interface ButtonPluginInfo {
	pluginId: string;
	tier: PluginTier;
}

export const BUTTON_PLUGIN_MAP = new Map<string, ButtonPluginInfo>();
for (const m of [aiAssistantManifest, imageOcclusionManifest]) {
	for (const btnId of m.toolbarButtonIds ?? []) {
		BUTTON_PLUGIN_MAP.set(btnId, {
			pluginId: m.info.id,
			tier: m.info.tier,
		});
	}
}
