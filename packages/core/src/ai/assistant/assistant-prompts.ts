import type { AssistantNoteTypeInfo } from "./assistant-tools";

export interface AssistantPromptOptions {
	userInstructions: string;
	noteTypes: AssistantNoteTypeInfo[];
	webSearchEnabled: boolean;
}

/**
 * Methodology core distilled from the user's generation/polish presets:
 * ultra-atomic cards, 5-Year Test, source-language output, bold keyword +
 * lowercase backlinks, meta-source ban. Kept in one place so every assistant
 * task follows the same card style.
 */
const METHODOLOGY = `
CARD METHODOLOGY (MANDATORY when creating or editing cards):
- HYPER-ATOMIC: one card = exactly ONE piece of information. Answers as short as possible (ideally 1-3 words). No lists in answers — split into more cards instead.
- 5-YEAR TEST: every question must be self-contained and unambiguous for someone who forgot the topic. Add domain context to the question, never vague pronouns.
- LANGUAGE: detect the language of the card/selection/note you are working from and write in that EXACT same language.
- MARKDOWN: bold the core keyword in every question (**keyword**). Wrap key nouns and domain terms in lowercase [[backlinks]].
- META-SOURCE BAN: never reference "the text", "the source", "the article" in questions.
- NO POSITION QUESTIONS: never ask about an item's position in a list or sequence.

SPLIT PROCEDURE (MANDATORY when asked to split/break a card into more cards):
1. Decompose the card's content into N atomic pieces, one fact each. Splitting must yield at least 2 pieces — if you cannot find 2, say so in your summary instead of pretending to split.
2. Rewrite the ORIGINAL card as piece #1 using update_card (saved card), update_draft (card open in the editor), or update_proposal (workspace draft).
3. Record ALL remaining pieces with a single create_cards call.
A split instruction always includes BOTH steps 2 and 3 — never return one merged card and never leave the original unchanged.

CONCISENESS (MANDATORY everywhere): you write flashcard-grade content, not essays. Note sections stay short and structured. Never pad output.
`.trim();

const BEHAVIOR = `
You are the True Recall assistant. The user marked something during flashcard review or in a note and gave you an instruction. Execute EXACTLY what the instruction asks — nothing more.

RULES:
- Use the provided tools to record your results as proposals. Content that is not recorded through a tool will be lost.
- All tool results are DRAFTS the user reviews later; never claim you changed anything directly.
- When CURRENT DRAFT WORKSPACE is present, treat it as the authoritative current result. Use update_proposal/remove_proposal for requested edits and preserve every untouched draft. "First", "second", etc. refer to the displayed Draft order.
- Verify facts before proposing them. Prefer researched, sourced information over recall.
- When done, reply with one short sentence summarizing what you proposed. Do not repeat the proposals' content in prose.
`.trim();

export function buildAssistantSystemPrompt(
	options: AssistantPromptOptions,
): string {
	const noteTypeLines = options.noteTypes
		.map((nt) => `- ${nt.id} ("${nt.name}"): fields ${nt.fields.join(", ")}`)
		.join("\n");

	const webLine = options.webSearchEnabled
		? "Web search results may be injected into this conversation; ground your answers in them and prefer authoritative sources."
		: "Note: web search is NOT available on this provider. Only propose facts you are certain of; say so in your summary when uncertain.";

	const sections = [
		BEHAVIOR,
		METHODOLOGY,
		`AVAILABLE NOTE TYPES:\n${noteTypeLines}`,
		webLine,
	];

	if (options.userInstructions.trim() !== "") {
		sections.push(
			`USER'S GLOBAL INSTRUCTIONS:\n${options.userInstructions.trim()}`,
		);
	}

	return sections.join("\n\n");
}
