import type { GenerationPreset } from "../../types/settings.types";
import { GENERATION_LANGUAGES } from "./default-prompts";

function resolveLanguageName(code: string): string {
	return GENERATION_LANGUAGES.find((l) => l.value === code)?.label ?? code;
}

export function buildVocabularyFlashcardPrompt(
	sourceLang: string,
	targetLang: string,
): string {
	const source = resolveLanguageName(sourceLang);
	const target = resolveLanguageName(targetLang);

	return (
		`You are a language teacher creating vocabulary flashcards for a ${target}-speaking student learning ${source}.\n\n` +
		`Extract key vocabulary words from the provided text. For each word, create a flashcard:\n\n` +
		`- Front: A short, realistic sentence (5-7 words) in ${source} using that word, but REPLACE the target word with its [${target} translation in brackets].\n` +
		`- Back: The target word in ${source}.\n\n` +
		`Rules:\n` +
		`- Sentences must be realistic and usable in conversation\n` +
		`- Use only common, known words in the sentence (except the target word)\n` +
		`- Keep sentences short (5-7 words maximum)\n` +
		`- Include the word in its natural grammatical form\n` +
		`- "source" must be an EXACT substring from the input text\n\n` +
		`Output a JSON array. Each element: {"type": "basic", "Front": "...", "Back": "...", "source": "..."}\n` +
		`Return ONLY the raw JSON array. No markdown fences, no explanation.`
	);
}

export function buildStandardVocabularyPrompt(
	sourceLang: string,
	targetLang: string,
): string {
	const source = resolveLanguageName(sourceLang);
	const target = resolveLanguageName(targetLang);

	return (
		`You are a language teacher creating vocabulary flashcards for a ${target}-speaking student learning ${source}.\n\n` +
		`Extract key vocabulary words from the provided text. For each word, create a flashcard:\n\n` +
		`- Front: The word or phrase in ${source} with pronunciation guide (IPA or phonetic)\n` +
		`- Back: ${target} translation + one example sentence in ${source} with ${target} translation\n\n` +
		`Rules:\n` +
		`- Include pronunciation on the Front\n` +
		`- Example sentences should be natural and short\n` +
		`- "source" must be an EXACT substring from the input text\n\n` +
		`Output a JSON array. Each element: {"type": "basic-reversed", "Front": "...", "Back": "...", "source": "..."}\n` +
		`Return ONLY the raw JSON array. No markdown fences, no explanation.`
	);
}

export function buildClozeSentencesPrompt(
	sourceLang: string,
	targetLang: string,
): string {
	const source = resolveLanguageName(sourceLang);
	const target = resolveLanguageName(targetLang);

	return (
		`You are a language teacher creating cloze flashcards for a ${target}-speaking student learning ${source}.\n\n` +
		`Extract key vocabulary from the provided text. For each word, create a cloze card:\n\n` +
		`- Text: A sentence in ${source} with the target word wrapped in {{c1::word}} cloze syntax\n` +
		`- Extra: ${target} translation of the full sentence\n\n` +
		`Rules:\n` +
		`- Only one cloze deletion per card\n` +
		`- Sentences should be short (5-10 words) and natural\n` +
		`- "source" must be an EXACT substring from the input text\n\n` +
		`Output a JSON array. Each element: {"type": "cloze", "Text": "...", "Extra": "...", "source": "..."}\n` +
		`Return ONLY the raw JSON array. No markdown fences, no explanation.`
	);
}

export function buildPresetPrompt(preset: GenerationPreset): string | null {
	if (preset.systemPrompt.trim()) return preset.systemPrompt;
	if (!preset.sourceLanguage || !preset.targetLanguage) return null;

	switch (preset.id) {
		case "builtin-vocabulary-flashcard":
			return buildVocabularyFlashcardPrompt(
				preset.sourceLanguage,
				preset.targetLanguage,
			);
		case "builtin-standard-vocabulary":
			return buildStandardVocabularyPrompt(
				preset.sourceLanguage,
				preset.targetLanguage,
			);
		case "builtin-cloze-sentences":
			return buildClozeSentencesPrompt(
				preset.sourceLanguage,
				preset.targetLanguage,
			);
		default:
			return null;
	}
}
