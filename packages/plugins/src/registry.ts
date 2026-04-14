import { aiGenerationManifest } from "./ai-generation";
import { healingFlashcardsManifest } from "./healing-flashcards";
import { imageOcclusionManifest } from "./image-occlusion";
import { knowledgeBaseManifest } from "./knowledge-base";
import { languageLearningManifest } from "./language-learning";
import { typeInModeManifest } from "./type-in-mode";
import type { PluginManifest } from "./types";

export const PLUGIN_MANIFESTS: PluginManifest[] = [
	imageOcclusionManifest,
	aiGenerationManifest,
	languageLearningManifest,
	knowledgeBaseManifest,
	typeInModeManifest,
	healingFlashcardsManifest,
];
