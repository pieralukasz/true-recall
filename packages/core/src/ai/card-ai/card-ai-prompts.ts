import type { ChatMessage } from "../clients/openrouter-client";
import type { CardAIContext, CardFields } from "./card-ai.types";

const SOURCE_NOTE_CHAR_LIMIT = 4000;

function systemPrompt(fieldNames: string[]): string {
	const keys = fieldNames.map((n) => `"${n}"`).join(", ");
	return `You are a flashcard editor. Apply the user's instruction to the given flashcard fields.

Respond with ONLY a single JSON object, with exactly these keys: { ${keys} } and nothing else.

Rules:
- No prose, no code fences, no commentary — just the JSON object.
- Apply the instruction to every field.
- For any empty field, write content that fits the instruction and stays consistent with the filled fields. Follow flashcard best practices: atomic (one fact per card), answerable without the question showing context from the answer, minimum information principle.
- Preserve facts, numbers, proper nouns, wikilinks ([[...]]), Obsidian callouts (> [!note]), LaTeX, and code verbatim unless the instruction explicitly asks to change them.
- Respond in the same language as the non-empty fields unless the instruction asks otherwise.`;
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
	if (ctx.sourceNoteContent && ctx.sourceNoteContent.trim()) {
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
	prompt: string;
	context?: CardAIContext;
}): ChatMessage[] {
	const user = `Instruction:\n${input.prompt.trim()}\n\nCurrent card:\n${formatFields(input.fields)}${formatContext(input.context)}`;
	return [
		{ role: "system", content: systemPrompt(Object.keys(input.fields)) },
		{ role: "user", content: user },
	];
}
