import { buildLanguageSuffix } from "./default-prompts";
import { resolveSlug } from "../../flashcard/note-types/note-type-slug";
export function buildCardFormatSpec(noteType) {
    const slug = resolveSlug(noteType);
    const entries = noteType.fields.map((f) => `"${f}": "..."`).join(", ");
    return (`Output a JSON array. Each element: {"type": "${slug}", ${entries}, "source": "..."}\n` +
        '"source" = copy-paste one sentence from the input that proves this fact. Must be an EXACT substring of the input — any mismatch breaks highlighting. Preserve ALL markdown formatting (**, *, ~~, ==, `, #, -, etc.). Copy raw markdown, not rendered text.\n' +
        "Return ONLY the raw JSON array.");
}
export function buildByokPrompt(noteType, languageCode, customPrompt) {
    const slug = resolveSlug(noteType);
    const entries = noteType.fields.map((f) => `"${f}": "..."`).join(", ");
    const langSuffix = buildLanguageSuffix(languageCode);
    const custom = customPrompt === null || customPrompt === void 0 ? void 0 : customPrompt.trim();
    return ("Generate flashcards from the provided text.\n\n" +
        (custom ? `${custom}\n\n` : "") +
        `Output a JSON array. Each element:\n{"type": "${slug}", ${entries}, "source": "..."}\n\n` +
        '"source" = copy-paste one sentence from the input that proves this fact. Must be an EXACT substring of the input (character-perfect) — any mismatch breaks highlighting. Preserve ALL markdown formatting (**, *, ~~, ==, `, #, -, etc.). Copy raw markdown, not rendered text. Never paraphrase.\n' +
        "Return ONLY the raw JSON array. No markdown fences, no explanation." +
        langSuffix);
}
