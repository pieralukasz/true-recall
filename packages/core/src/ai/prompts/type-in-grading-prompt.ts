const SOURCE_NOTE_CHAR_LIMIT = 10000;

export interface TypeInGradingPromptRelatedCard {
	fields: Record<string, string>;
	noteType: string;
}

export interface TypeInGradingPromptInput {
	question: string;
	correctAnswer: string;
	userAnswer: string;
	sourceContext?: string;
	sourceNotePath?: string;
	relatedCards?: TypeInGradingPromptRelatedCard[];
}

export const DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT =
	"You are a teacher grading a learner's typed flashcard answer.\n" +
	"The learner answers in their own words, like explaining to a child. Grade understanding, not wording.\n" +
	'An answer that captures the mechanism or meaning is "correct" even without the source terminology.\n' +
	'"partial" means the core idea is there but important facts are missing or fuzzy.\n' +
	'"wrong" means the core idea is missing or contradicted.\n' +
	"Use the source note and related flashcards (when provided) only as background for domain terminology, synonyms, and the expected scope: never as a substitute for the user's answer.\n" +
	"Your entire reply must be a single JSON object, starting with { and ending with }:\n" +
	'{"verdict": "correct"|"partial"|"wrong", "teacherComment": string, "covered": string[], "missing": string[], "errors": string[], "suggestedRating": "again"|"hard"|"good"|"easy"}\n' +
	"teacherComment: 2-3 warm, specific sentences in the language of the user's answer.\n" +
	"covered/missing: short key facts (max 5 each). errors: only real contradictions of the source (max 3), else [].\n" +
	"suggestedRating: again = wrong or blank understanding, hard = partial with significant gaps, good = correct with minor gaps, easy = complete and effortless.\n" +
	"No markdown, no code fences, no text outside the JSON object.";

function buildSourceNoteSection(input: TypeInGradingPromptInput): string[] {
	const text = input.sourceContext?.trim();
	if (!text) return [];
	const path = input.sourceNotePath ? ` (${input.sourceNotePath})` : "";
	const body = input.sourceContext?.slice(0, SOURCE_NOTE_CHAR_LIMIT) ?? "";
	const truncated =
		(input.sourceContext?.length ?? 0) > SOURCE_NOTE_CHAR_LIMIT ? "\n…" : "";
	return [
		`Source note${path} (background only: judge synonyms and domain terminology):`,
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
		"Related flashcards from the same source (background only: show the expected scope and terminology; do not treat them as the user's answer):",
		formatted,
		"",
	];
}

export function buildTypeInGradingMessages(
	input: TypeInGradingPromptInput,
): Array<{ role: "system" | "user"; content: string }> {
	return [
		{
			role: "system",
			content: DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT,
		},
		{
			role: "user",
			content: [
				...buildSourceNoteSection(input),
				...buildRelatedCardsSection(input),
				`Question: ${input.question}`,
				`Correct answer: ${input.correctAnswer}`,
				`User answer: ${input.userAnswer}`,
				"Output JSON only with keys: verdict, teacherComment, covered, missing, errors, suggestedRating",
			].join("\n"),
		},
	];
}
