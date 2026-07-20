import type { PluginTier } from "@true-recall/core/types";

import { aiAssistantManifest } from "./ai-assistant";
import { aiGenerationManifest } from "./ai-generation";
import { ankiImportExportManifest } from "./anki-import-export";
import { cardPolishManifest } from "./card-polish";
import { dashboardCodeblockManifest } from "./dashboard-codeblock";
import { imageOcclusionManifest } from "./image-occlusion";
import { knowledgeBaseManifest } from "./knowledge-base";
import { linkStatusIndicatorsManifest } from "./link-status-indicators";
import { selectionToolbarManifest } from "./selection-toolbar";
import { statusBarWidgetManifest } from "./status-bar-widget";
import { typeInModeManifest } from "./type-in-mode";
import type { PluginManifest } from "./types";

export const PLUGIN_MANIFESTS: PluginManifest[] = [
	selectionToolbarManifest,
	linkStatusIndicatorsManifest,
	dashboardCodeblockManifest,
	statusBarWidgetManifest,
	aiGenerationManifest,
	cardPolishManifest,
	aiAssistantManifest,
	imageOcclusionManifest,
	knowledgeBaseManifest,
	typeInModeManifest,
	ankiImportExportManifest,
];

export interface ButtonPluginInfo {
	pluginId: string;
	tier: PluginTier;
}

export const BUTTON_PLUGIN_MAP = new Map<string, ButtonPluginInfo>();
for (const m of PLUGIN_MANIFESTS) {
	for (const btnId of m.toolbarButtonIds ?? []) {
		BUTTON_PLUGIN_MAP.set(btnId, {
			pluginId: m.info.id,
			tier: m.info.tier,
		});
	}
}
