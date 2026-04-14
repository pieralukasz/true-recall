import { aiGenerationManifest } from "./ai-generation";
import { ankiImportExportManifest } from "./anki-import-export";
import { dashboardCodeblockManifest } from "./dashboard-codeblock";
import { gamificationManifest } from "./gamification";
import { healingFlashcardsManifest } from "./healing-flashcards";
import { imageOcclusionManifest } from "./image-occlusion";
import { knowledgeBaseManifest } from "./knowledge-base";
import { languageLearningManifest } from "./language-learning";
import { linkStatusIndicatorsManifest } from "./link-status-indicators";
import { statusBarWidgetManifest } from "./status-bar-widget";
import { typeInModeManifest } from "./type-in-mode";
import type { PluginManifest } from "./types";

export const PLUGIN_MANIFESTS: PluginManifest[] = [
	imageOcclusionManifest,
	aiGenerationManifest,
	languageLearningManifest,
	knowledgeBaseManifest,
	typeInModeManifest,
	healingFlashcardsManifest,
	linkStatusIndicatorsManifest,
	dashboardCodeblockManifest,
	gamificationManifest,
	statusBarWidgetManifest,
	ankiImportExportManifest,
];
