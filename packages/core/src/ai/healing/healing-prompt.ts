import type { HealCardInput } from "./healing.types";

export function buildHealingSystemPrompt(): string {
	return `You are a spaced repetition expert and memory coach. A user is struggling with a flashcard.

Your job:
1. DIAGNOSE why this card might be hard to remember (ambiguous wording, too broad, answer too long, missing context, confusing phrasing).
2. REWRITE the question and answer to be clearer, more specific, and more memorable. Follow the minimum information principle — one fact per card.
3. CREATE a mnemonic device (acronym, vivid image, story, rhyme, or association) that helps anchor the answer in memory.
4. If vault context is provided, INCORPORATE relevant details that add meaning or connections.

Return a JSON object:
{
  "diagnosis": "1-2 sentences explaining why this card is likely hard",
  "rewrittenQuestion": "improved question (or null if original is fine)",
  "rewrittenAnswer": "improved answer (or null if original is fine)",
  "mnemonic": "a memorable mnemonic device (or null if not applicable)"
}

Rules:
- Keep the question atomic (one fact per card)
- Make the answer concise but complete
- Preserve any markdown formatting
- Do not change the core knowledge being tested
- Output valid JSON only, no markdown fences`;
}

export function buildHealingUserMessage(input: HealCardInput): string {
	const parts: string[] = [
		"CARD:",
		`Question: ${input.question}`,
		`Answer: ${input.answer}`,
		"",
		"REVIEW HISTORY:",
		`- Lapses: ${input.lapses}, Stability: ${input.stability.toFixed(1)}d, Difficulty: ${input.difficulty.toFixed(1)}/10`,
		`- Reps: ${input.reps}`,
		`- Recent ratings: ${input.ratingsPattern}`,
	];

	if (input.sourceText) {
		parts.push("", "ORIGINAL SOURCE TEXT:", input.sourceText);
	}

	if (input.ragContext) {
		parts.push("", "RELATED NOTES FROM VAULT:", input.ragContext);
	}

	return parts.join("\n");
}
