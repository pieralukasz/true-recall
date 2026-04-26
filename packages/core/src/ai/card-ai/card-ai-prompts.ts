import type { ChatMessage } from "../clients/openrouter-client";
import type { CardAIContext, CardFields } from "./card-ai.types";

const SOURCE_NOTE_CHAR_LIMIT = 4000;

function systemPrompt(noteType: {
	name: string;
	fields: readonly string[];
}): string {
	const keys = noteType.fields.map((n) => `"${n}"`).join(", ");
	return `You are a flashcard editor. Respond with ONLY a JSON array (no prose, no code fences, no commentary).

Every element is a card of note type "${noteType.name}" with this exact field set: { ${keys} }.

Element [0] is ALWAYS the current card.
- If the user's instruction asks to modify the current card → apply changes to [0].
- If the user's instruction does NOT ask to modify the current card → [0] is the original fields VERBATIM.

Elements [1..N] are NEW cards (same note type, same field set). Include them ONLY when the user's instruction explicitly asks to create new cards (e.g. "create a card about X", "stwórz fiszkę dotyczącą Y", "add a flashcard for Z", "spawn a derived card", "dodaj kartę o W"). Otherwise omit [1..N] entirely — return a single-element array.

Do NOT invent cards the user did not request. Do NOT modify [0] if the user did not request it.

When in doubt, return [original_fields_verbatim] — one element, no changes.`;
}

function formatFields(fields: CardFields): string {
	return Object.entries(fields)
		.map(([n, v]) =>
			v.trim().length === 0 ? `${n}: (empty)` : `${n}:\n${v.trim()}`,
		)
		.join("\n\n");
}

function formatContext(ctx?: CardAIContext): string {
	if (!ctx) return "";
	const parts: string[] = [];
	if (ctx.sourceNoteContent?.trim()) {
		const path = ctx.sourceNotePath ? ` (${ctx.sourceNotePath})` : "";
		const body = ctx.sourceNoteContent.slice(0, SOURCE_NOTE_CHAR_LIMIT);
		const suffix =
			ctx.sourceNoteContent.length > SOURCE_NOTE_CHAR_LIMIT ? "\n…" : "";
		parts.push(`Source note${path}:\n${body}${suffix}`);
	}
	if (ctx.relatedCards?.length) {
		const r = ctx.relatedCards
			.map((c, i) => {
				const body = Object.entries(c.fields)
					.map(([k, v]) => `  ${k}: ${v}`)
					.join("\n");
				return `#${i + 1} (${c.noteType})\n${body}`;
			})
			.join("\n\n");
		parts.push(
			`Related flashcards (for style and terminology reference only; do not copy):\n${r}`,
		);
	}
	return parts.length ? `\n\n${parts.join("\n\n")}` : "";
}

export function buildCardAIMessages(input: {
	fields: CardFields;
	noteType: { name: string; fields: readonly string[] };
	prompt: string;
	context?: CardAIContext;
}): ChatMessage[] {
	const user = `Instruction:\n${input.prompt.trim()}\n\nCurrent card (note type: ${input.noteType.name}):\n${formatFields(input.fields)}${formatContext(input.context)}`;
	return [
		{ role: "system", content: systemPrompt(input.noteType) },
		{ role: "user", content: user },
	];
}
