import type { PluginInfo } from "@true-recall/core/types";

export const ALL_PLUGINS: PluginInfo[] = [
	{
		id: "image-occlusion",
		name: "Image Occlusion",
		description:
			"Create flashcards by masking regions of images. Draw rectangles and ellipses over diagrams, maps, or any image to test visual recall.",
		features: [
			"Draw rectangular and elliptical occlusion regions",
			"AI-powered automatic region detection",
			"Multiple mask modes: hide one / hide all",
			"Edit existing occlusion cards",
		],
		icon: "image",
		requiresPro: true,
	},
	{
		id: "ai-generation",
		name: "AI Flashcard Generation",
		description:
			"Generate flashcards from your notes using AI. Select text, pick a note type, and let AI create structured flashcards.",
		features: [
			"Generate from selected text or entire notes",
			"Multiple note type support (basic, cloze, reversed)",
			"Custom generation prompts",
			"Semantic answer grading in type-in mode",
		],
		icon: "sparkles",
		requiresPro: true,
	},
	{
		id: "language-learning",
		name: "Language Learning",
		description:
			"Study vocabulary with language-specific flashcard presets, TTS audio, and targeted generation prompts.",
		features: [
			"29 language presets with curated prompts",
			"Text-to-speech audio generation",
			"Per-preset source and target language",
			"Custom vocabulary note types",
		],
		icon: "languages",
		requiresPro: true,
	},
	{
		id: "healing-flashcards",
		name: "Healing Flashcards",
		description:
			"Automatically generate flashcards that target your weak spots, based on review mistakes and lapse patterns.",
		features: [
			"Detects recurring mistakes from review history",
			"Generates corrective cards for problem areas",
			"Adapts to your learning patterns over time",
		],
		icon: "heart-pulse",
		requiresPro: true,
	},
];
