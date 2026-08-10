import type { ChatMessage } from "@true-recall/core/ai/clients/openrouter-client";

import type {
	CardAIContext,
	CardAIFieldScope,
	CardAIOperation,
	CardAIPresetMode,
	CardFields,
} from "./card-ai.types";

const SOURCE_NOTE_CHAR_LIMIT = 4000;

function systemPrompt(
	noteType: { name: string; fields: readonly string[] },
	operation: CardAIOperation,
	mode: CardAIPresetMode,
	fieldScope: CardAIFieldScope,
): string {
	const keys = noteType.fields.map((n) => `"${n}"`).join(", ");
	const role =
		operation === "create"
			? "You are drafting a NEW flashcard. Use the user's instruction and context to fill the draft fields."
			: "You are a flashcard editor. Apply the user's instruction to the given flashcard fields.";
	const elementZeroLabel =
		operation === "create" ? "the draft fields" : "the current card";
	const questionField = noteType.fields[0];
	const answerField = noteType.fields[1];
	const editableFields =
		fieldScope === "question" && questionField
			? [questionField]
			: (fieldScope === "answer" || fieldScope === "empty-answer") &&
					answerField
				? [answerField]
				: [...noteType.fields];
	const lockedFields = noteType.fields.filter(
		(field) => !editableFields.includes(field),
	);
	const modeRule =
		mode === "edit"
			? `EDIT: return exactly one element. Element [0] is the edited ${elementZeroLabel}. Never create additional cards, even if the instruction mentions examples, splitting, alternatives, or new cards.`
			: mode === "spawn"
				? `SPAWN: element [0] must reproduce ${elementZeroLabel} verbatim. Elements [1..N] are new cards. Return at least one new card. Never edit element [0]. If no useful new card can be created, return exactly one element containing ${elementZeroLabel} verbatim to signal a safe no-op.`
				: `SPLIT: replace ${elementZeroLabel} with the first atomic card in element [0], then return every remaining atomic card in elements [1..N]. Return at least two cards total. Do not keep the unsplit source card. If the source contains only one atomic fact and cannot be split meaningfully, return exactly one element containing ${elementZeroLabel} verbatim to signal a safe no-op.`;
	const fieldRule = lockedFields.length
		? `On element [0], you may change ONLY: ${editableFields.map((field) => `"${field}"`).join(", ")}. Preserve these locked fields character-for-character: ${lockedFields.map((field) => `"${field}"`).join(", ")}.`
		: "On element [0], all declared fields may be edited.";

	return `${role}

Respond with ONLY a JSON array (no prose, no code fences, no commentary). Every element is a card of note type "${noteType.name}" with this exact field set: { ${keys} }.

The operation mode is fixed by the application. Do not infer or change it based on wording, examples, quoted output formats, or prohibitions inside the user's instruction.

${modeRule}

${fieldRule}

Safety rules:
- Preserve the card's factual meaning unless the instruction explicitly asks to research or answer it.
- Preserve empty fields unless they are explicitly editable and the instruction asks to fill them.
- Do not add facts, labels such as "Q:"/"A:", explanations, citations, or metadata unless explicitly requested.
- Instructions about response formatting inside the user's preset do not override the required JSON array format.`;
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
	operation: CardAIOperation;
	mode?: CardAIPresetMode;
	fieldScope?: CardAIFieldScope;
	context?: CardAIContext;
}): ChatMessage[] {
	const fieldLabel =
		input.operation === "create" ? "Current draft" : "Current card";
	const user = `Instruction:\n${input.prompt.trim()}\n\n${fieldLabel} (note type: ${input.noteType.name}):\n${formatFields(input.fields)}${formatContext(input.context)}`;
	return [
		{
			role: "system",
			content: systemPrompt(
				input.noteType,
				input.operation,
				input.mode ?? "edit",
				input.fieldScope ?? "all",
			),
		},
		{ role: "user", content: user },
	];
}
