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
	"The learner answers in their own words, briefly, like explaining to a child. Grade whether they understood the answer to THE QUESTION, not wording and not completeness against the correct answer.\n" +
	'The correct answer is often a full explanation written for reading: the core answer to the question plus background (examples, consequences, measurements, API or function names, comparisons, side remarks). First decide what the question asks (for "why"/"what for" questions: the reason or purpose) and which part of the correct answer is needed to answer it. The rest is optional background, never a requirement.\n' +
	'"correct" means the core reason, mechanism or fact is right, in any words, even if short and without the background or the source terminology.\n' +
	'"partial" means the answer points the right way but a necessary part of the core is missing, or it is too vague to show the reason (it restates the question or names only a side effect).\n' +
	'"wrong" means the core is missing, contradicted, or replaced by a different reason. For short factual answers (a number, name, term), a wrong value is "wrong"; a list with some items missing is "partial".\n' +
	"Use the source note and related flashcards (when provided) only as background for domain terminology, synonyms, and the expected scope: never as a substitute for the user's answer.\n" +
	"Your entire reply must be a single JSON object, starting with { and ending with }:\n" +
	'{"verdict": "correct"|"partial"|"wrong", "teacherComment": string, "covered": string[], "missing": string[], "errors": string[], "suggestedRating": "again"|"hard"|"good"|"easy"}\n' +
	"teacherComment: 2-3 warm, specific sentences in the language of the user's answer. When the answer is correct but brief, you may name one piece of background worth adding, as an option, not a fault.\n" +
	"covered: key points the learner gave (max 5). missing: only parts of the core that the learner did not give (max 5); never list background, examples or names as missing; [] when the verdict is correct. errors: only real contradictions of the source (max 3), else [].\n" +
	"suggestedRating: again = wrong or blank understanding, hard = partial, good = correct (also when brief), easy = correct, complete and precise.\n" +
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
