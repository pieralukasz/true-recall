const SOURCE_NOTE_CHAR_LIMIT = 4000;

export interface TypeInGradingPromptRelatedCard {
	fields: Record<string, string>;
	noteType: string;
}

export interface TypeInGradingPromptInput {
	question: string;
	correctAnswer: string;
	userAnswer: string;
	passThreshold: number;
	sourceContext?: string;
	sourceNotePath?: string;
	relatedCards?: TypeInGradingPromptRelatedCard[];
}

export const DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT =
	"You are grading typed answers for flashcards.\n" +
	"Evaluate semantic correctness, not wording.\n" +
	"Penalize missing critical facts and contradictions.\n" +
	"Use the source note and related flashcards (when provided) only as background to judge domain-specific terminology, synonyms, and the expected scope — never as a substitute for the user's answer.\n" +
	"Be concise and fair.\n" +
	'Return JSON only with keys: {"score": number, "feedback": string}.\n' +
	"score must be 0-100.\n" +
	"feedback must be at most 2 short sentences.\n" +
	"Do not return markdown or code fences.";

function buildSourceNoteSection(input: TypeInGradingPromptInput): string[] {
	const text = input.sourceContext?.trim();
	if (!text) return [];
	const path = input.sourceNotePath ? ` (${input.sourceNotePath})` : "";
	const body = input.sourceContext?.slice(0, SOURCE_NOTE_CHAR_LIMIT) ?? "";
	const truncated =
		(input.sourceContext?.length ?? 0) > SOURCE_NOTE_CHAR_LIMIT ? "\n…" : "";
	return [
		`Source note${path} (background only — judge synonyms and domain terminology):`,
		"<context>",
		`${body}${truncated}`,
		"</context>",
		"",
	];
}

function buildRelatedCardsSection(input: TypeInGradingPromptInput): string[] {
	const cards = input.relatedCards;
	if (!cards?.length) return [];
	const formatted = cards
		.map((card, index) => {
			const body = Object.entries(card.fields)
				.map(([name, value]) => `  ${name}: ${value}`)
				.join("\n");
			return `#${index + 1} (${card.noteType})\n${body}`;
		})
		.join("\n\n");
	return [
		"Related flashcards from the same source (background only — show the expected scope and terminology; do not treat them as the user's answer):",
		formatted,
		"",
	];
}

export function buildTypeInGradingMessages(
	input: TypeInGradingPromptInput,
	customSystemPrompt?: string,
): Array<{ role: "system" | "user"; content: string }> {
	const systemPrompt = customSystemPrompt?.trim().length
		? customSystemPrompt
		: DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT;

	return [
		{
			role: "system",
			content: systemPrompt,
		},
		{
			role: "user",
			content: [
				...buildSourceNoteSection(input),
				...buildRelatedCardsSection(input),
				`Question: ${input.question}`,
				`Correct answer: ${input.correctAnswer}`,
				`User answer: ${input.userAnswer}`,
				`Pass threshold: ${input.passThreshold}`,
				'Output JSON only: {"score": number, "feedback": string}',
			].join("\n"),
		},
	];
}
