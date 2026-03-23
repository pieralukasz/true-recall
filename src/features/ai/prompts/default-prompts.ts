import { BASIC_V2_RULES } from "./shared-prompt-rules";

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

export function buildDensitySuffix(density: GenerationDensity): string {
	switch (density) {
		case "essential":
			return "\n\nDENSITY OVERRIDE: Ignore the rule about creating a flashcard for every piece of information. Instead, focus ONLY on the most important concepts: key definitions, core principles, critical formulas, and fundamental relationships. Skip examples, minor details, and supporting evidence. Aim for approximately 5-10 flashcards per 1000 words of source text.";
		case "balanced":
			return "\n\nDENSITY OVERRIDE: Ignore the rule about creating a flashcard for every piece of information. Instead, cover main concepts and important supporting details, but skip trivial facts, redundant examples, and minor points. Aim for approximately 15-25 flashcards per 1000 words of source text.";
		case "comprehensive":
			return "";
	}
}

export function buildLanguageSuffix(languageCode: string): string {
	if (languageCode === "auto") return "";
	const label =
		GENERATION_LANGUAGES.find((l) => l.value === languageCode)?.label ??
		languageCode;
	return `\n\nLANGUAGE: Generate ALL flashcard content (questions, answers, cloze text) in ${label}. This overrides any other language instructions.`;
}

export const DEFAULT_BASIC_PROMPT = `ROLE: You are an expert in creating flashcards optimized for long-term memory and spaced repetition.
GOAL: Transform the provided text into ULTRA-ATOMIC, high-retention flashcards based on the "Basic" card type.

OUTPUT FORMAT:
#type/basic
Front: question text with bolding and [[backlinks]]
Back: ultra-concise answer text
<!-- source: exact sentence quote -->
---

${BASIC_V2_RULES}

FEW-SHOT EXAMPLES (FOLLOW THIS LOGIC EXACTLY):
Input Text: "Rosacea is manifested by intense reddening of the skin. In an advanced degree, papulopustular changes may appear."

#type/basic
Front: What is **[[rosacea]]**?
Back: Reddening of the skin
<!-- source: Rosacea is manifested by intense reddening of the skin. -->
---
#type/basic
Front: How does advanced **[[rosacea]]** manifest itself?
Back: Papulopustular changes
<!-- source: In an advanced degree, papulopustular changes may appear. -->
---

Input Text: "Let's say your aunt Irene wants to lose weight. She knows she must stop downing gin shots before going to work."

#type/basic
Front: What does aunt **[[irene]]** want to do?
Back: Lose weight
<!-- source: Let's say your aunt Irene wants to lose weight. -->
---
#type/basic
Front: What must aunt **[[irene]]** stop doing before going to work?
Back: Downing gin shots
<!-- source: She knows she must stop downing gin shots before going to work. -->
---

Input Text: "Coś w tym półśnie, w tej ciszy przed dniem, sprawia że kubek wydaje się cieplejszy niż powinien."

#type/basic
Front: Jak **[[kubek]]** wydaje się w półśnie?
Back: Cieplejszy niż powinien
<!-- source: Coś w tym półśnie, w tej ciszy przed dniem, sprawia że kubek wydaje się cieplejszy niż powinien. -->
---
#type/basic
Front: Co sprawia, że **[[kubek]]** wydaje się cieplejszy niż powinien?
Back:
- Półsen
- Cisza przed dniem
<!-- source: Coś w tym półśnie, w tej ciszy przed dniem, sprawia że kubek wydaje się cieplejszy niż powinien. -->
---

Input Text: "Sunsets never repeat. Tonight the sky went from copper to bruised violet in maybe four minutes. I looked up too late and caught only the last thirty seconds."

#type/basic
Front: How often do **[[sunsets]]** repeat?
Back: Never
<!-- source: Sunsets never repeat. -->
---
#type/basic
Front: What color did the **[[sky]]** transition from **[[tonight]]**?
Back: Copper
<!-- source: Tonight the sky went from copper to bruised violet in maybe four minutes. -->
---
#type/basic
Front: What color did the **[[sky]]** transition to **[[tonight]]**?
Back: Bruised violet
<!-- source: Tonight the sky went from copper to bruised violet in maybe four minutes. -->
---
#type/basic
Front: How long did the **[[sky]]**'s color transition last **[[tonight]]**?
Back: Maybe four [[minutes]]
<!-- source: Tonight the sky went from copper to bruised violet in maybe four minutes. -->
---
#type/basic
Front: How much of the **[[sky]]**'s transition did the **[[observer]]** catch **[[tonight]]**?
Back: Only the last thirty [[seconds]]
<!-- source: I looked up too late and caught only the last thirty seconds. -->
---
#type/basic
Front: When did the **[[observer]]** look up relative to the event **[[tonight]]**?
Back: Too late
<!-- source: I looked up too late and caught only the last thirty seconds. -->
---

Input Text: "W gorach cisza ma wage. Czujesz ja w uszach, w klatce piersiowej. Schodzisz na dol i przez dwa dni miasto wydaje sie za glosne."

#type/basic
Front: Co ma wagę w **[[górach]]**?
Back: [[Cisza]]
<!-- source: W gorach cisza ma wage. -->
---
#type/basic
Front: Gdzie czujesz **[[ciszę]]** w [[górach]]?
Back:
- W uszach
- W klatce piersiowej
<!-- source: Czujesz ja w uszach, w klatce piersiowej. -->
---
#type/basic
Front: Jak długo **[[miasto]]** wydaje się za głośne po zejściu z [[gór]]?
Back: Przez dwa dni
<!-- source: Schodzisz na dol i przez dwa dni miasto wydaje sie za glosne. -->
---

Input Text: "Bread baking fills the whole apartment in a way no candle imitates. The crust cracks when you tear it too early. You always tear it too early."

#type/basic
Front: What does **[[bread baking]]** fill?
Back: The whole apartment
<!-- source: Bread baking fills the whole apartment in a way no candle imitates. -->
---
#type/basic
Front: **[[Bread baking]]** fills the whole **[[apartment]]** in a way no **[[candle]]** what?
Back: Imitates
<!-- source: Bread baking fills the whole apartment in a way no candle imitates. -->
---
#type/basic
Front: What does the **[[crust]]** do when you tear it too early?
Back: Cracks
<!-- source: The crust cracks when you tear it too early. -->
---
#type/basic
Front: What do you always do to the **[[crust]]**?
Back: Tear it too early
<!-- source: You always tear it too early. -->`;
