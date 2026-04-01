import type { ChatMessage } from "../clients/openrouter-client";

const CLASSIFY_SYSTEM = `You classify flashcards into the most appropriate category from a given list.

Rules:
- Each card gets exactly ONE category from the list below.
- Choose the most specific matching category.
- If no specific category fits well, use the broadest parent category.
- Return ONLY a raw JSON array. No markdown fences, no explanation.

Format: [{"id": <number>, "deck": "<full/category/path>"}]`;

const CLEANUP_SYSTEM = `Clean up flashcard text fields:
- Fix leftover HTML entities (&amp; → &, &lt; → <, &nbsp; → space, etc.)
- Fix leftover HTML tags (<br>, <div>, <span>, etc.) → appropriate markdown or whitespace
- Fix broken markdown (unclosed **, *, ~~, \`)
- Normalize excessive whitespace and line breaks
- Trim empty trailing content

Rules:
- Do NOT change the meaning or rephrase any content.
- Do NOT add new content or explanations.
- Do NOT process image/audio embeds (![[...]]) — leave them exactly as-is.
- If a field is already clean, return it unchanged.
- Return ONLY a raw JSON array. No markdown fences, no explanation.

Format: [{"id": <number>, "fields": {<fieldName>: "<cleaned value>", ...}}]`;

export function buildClassifyMessages(
	deckNames: string[],
	cards: { id: number; q: string }[],
): ChatMessage[] {
	const categories = deckNames.map((d) => `- ${d}`).join("\n");

	return [
		{
			role: "system",
			content: `${CLASSIFY_SYSTEM}\n\nCategories:\n${categories}`,
		},
		{
			role: "user",
			content: JSON.stringify(cards),
		},
	];
}

export function buildCleanupMessages(
	cards: { id: number; fields: Record<string, string> }[],
): ChatMessage[] {
	return [
		{ role: "system", content: CLEANUP_SYSTEM },
		{ role: "user", content: JSON.stringify(cards) },
	];
}

export function stripImageEmbeds(
	fields: Record<string, string>,
): Record<string, string> {
	const cleaned: Record<string, string> = {};
	for (const [key, value] of Object.entries(fields)) {
		// Replace image/audio embeds with placeholder to avoid sending to AI
		cleaned[key] = value.replace(/!\[\[[^\]]+\]\]/g, "[media]");
	}
	return cleaned;
}

export function restoreImageEmbeds(
	original: Record<string, string>,
	cleaned: Record<string, string>,
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, origValue] of Object.entries(original)) {
		const cleanedValue = cleaned[key];
		if (cleanedValue === undefined) {
			result[key] = origValue;
			continue;
		}

		// If original had no embeds, use cleaned directly
		if (!origValue.includes("![[")) {
			result[key] = cleanedValue;
			continue;
		}

		// Restore embeds from original into cleaned text
		const origEmbeds: string[] = [];
		origValue.replace(/!\[\[[^\]]+\]\]/g, (match) => {
			origEmbeds.push(match);
			return "";
		});

		let embedIdx = 0;
		result[key] = cleanedValue.replace(/\[media\]/g, () => {
			return origEmbeds[embedIdx++] ?? "[media]";
		});
	}
	return result;
}
