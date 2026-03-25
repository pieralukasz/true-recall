export type GenerationMode = "basic";

export const GENERATION_LANGUAGES = [
	{ value: "auto", label: "Auto-detect (match source text)" },
	{ value: "en", label: "English" },
	{ value: "es", label: "Spanish" },
	{ value: "fr", label: "French" },
	{ value: "de", label: "German" },
	{ value: "it", label: "Italian" },
	{ value: "pt", label: "Portuguese" },
	{ value: "nl", label: "Dutch" },
	{ value: "ru", label: "Russian" },
	{ value: "uk", label: "Ukrainian" },
	{ value: "pl", label: "Polish" },
	{ value: "cs", label: "Czech" },
	{ value: "tr", label: "Turkish" },
	{ value: "ar", label: "Arabic" },
	{ value: "hi", label: "Hindi" },
	{ value: "ja", label: "Japanese" },
	{ value: "zh-CN", label: "Chinese (Simplified)" },
	{ value: "zh-TW", label: "Chinese (Traditional)" },
	{ value: "ko", label: "Korean" },
	{ value: "vi", label: "Vietnamese" },
	{ value: "th", label: "Thai" },
	{ value: "id", label: "Indonesian" },
	{ value: "sv", label: "Swedish" },
	{ value: "no", label: "Norwegian" },
	{ value: "da", label: "Danish" },
	{ value: "fi", label: "Finnish" },
	{ value: "el", label: "Greek" },
	{ value: "ro", label: "Romanian" },
	{ value: "hu", label: "Hungarian" },
	{ value: "he", label: "Hebrew" },
] as const;

export type GenerationDensity = "essential" | "balanced" | "comprehensive";

export const GENERATION_DENSITY_OPTIONS: {
	value: GenerationDensity;
	label: string;
	description: string;
}[] = [
	{
		value: "essential",
		label: "Essential",
		description:
			"Only core concepts and definitions (~5-10 cards per 1000 words)",
	},
	{
		value: "balanced",
		label: "Balanced",
		description:
			"Main ideas and important details (~15-25 cards per 1000 words)",
	},
	{
		value: "comprehensive",
		label: "Comprehensive",
		description: "Every piece of information (~40-60 cards per 1000 words)",
	},
];

export function buildLanguageSuffix(languageCode: string): string {
	if (languageCode === "auto") return "";
	const label =
		GENERATION_LANGUAGES.find((l) => l.value === languageCode)?.label ??
		languageCode;
	return `\n\nLANGUAGE: Generate ALL flashcard content (questions, answers, cloze text) in ${label}. This overrides any other language instructions.`;
}
