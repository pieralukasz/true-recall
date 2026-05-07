import type { ChatMessage } from "@true-recall/core/ai/clients/openrouter-client";
import type { CardAIContext, CardFields } from "./card-ai.types";
import type { CardAITargetOperation } from "./card-ai-target";

const SOURCE_NOTE_CHAR_LIMIT = 4000;

function systemPrompt(
	noteType: { name: string; fields: readonly string[] },
	operation: CardAITargetOperation,
): string {
	const keys = noteType.fields.map((n) => `"${n}"`).join(", ");
	const role =
		operation === "create"
			? "You are drafting a NEW flashcard. Use the user's instruction and context to fill the draft fields."
			: "You are a flashcard editor. Apply the user's instruction to the given flashcard fields.";
	const elementZeroLabel =
		operation === "create" ? "the draft fields" : "the current card";

	return `${role}

Respond with ONLY a JSON array (no prose, no code fences, no commentary). Every element is a card of note type "${noteType.name}" with this exact field set: { ${keys} }.

Element [0] is ALWAYS ${elementZeroLabel}.
Elements [1..N] are NEW cards (same note type, same field set).

Three modes — pick exactly one based on the user's instruction:

1. EDIT mode — user asks to rewrite, polish, fix, translate, or otherwise modify ${elementZeroLabel}.
   → [0] = the modified fields. No [1..N].

2. SPAWN mode — user asks to create new cards alongside ${elementZeroLabel} (verbs like "create a card about", "add a flashcard for", "spawn a derived card", "stwórz fiszkę", "dodaj kartę").
   → [0] = the original fields VERBATIM. [1..N] = the requested new cards.

3. SPLIT mode — user asks to decompose, break apart, or expand ${elementZeroLabel} into multiple cards (verbs like "split", "decompose", "break apart", "expand into separate", "one card per item", "rozbij", "rozdziel").
   → [0] = the original fields VERBATIM (do NOT delete or shorten the source). [1..N] = the resulting cards, one per item.

Default — if the instruction matches none of the three modes, return [original_fields_verbatim] (single element, no changes).

Do NOT invent cards the user did not request. Never combine modes (e.g. don't both edit [0] and spawn extras unless the user asked for both).`;
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
	operation: CardAITargetOperation;
	context?: CardAIContext;
}): ChatMessage[] {
	const fieldLabel =
		input.operation === "create" ? "Current draft" : "Current card";
	const user = `Instruction:\n${input.prompt.trim()}\n\n${fieldLabel} (note type: ${input.noteType.name}):\n${formatFields(input.fields)}${formatContext(input.context)}`;
	return [
		{
			role: "system",
			content: systemPrompt(input.noteType, input.operation),
		},
		{ role: "user", content: user },
	];
}
