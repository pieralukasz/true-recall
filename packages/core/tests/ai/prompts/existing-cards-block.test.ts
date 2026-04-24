import { describe, expect, it } from "vitest";

import {
	EXISTING_CARDS_MAX_COUNT,
	EXISTING_CARDS_MAX_TOKENS,
	type ExistingCardContext,
	renderExistingCardsBlock,
} from "../../../src/ai/prompts/existing-cards-block";

function makeCard(id: string, q: string, a: string): ExistingCardContext {
	return { id, question: q, answer: a };
}

describe("renderExistingCardsBlock", () => {
	it("returns a no-cards sentinel when list is empty", () => {
		const result = renderExistingCardsBlock([]);
		expect(result).toBe("No existing cards yet for this note.");
	});

	it("renders each card as a '- Q: ... | A: ...' bullet", () => {
		const cards = [
			makeCard("1", "What is rosacea?", "Skin reddening"),
			makeCard(
				"2",
				"When is phase 2 close?",
				"When last 20% of effort yields <5%",
			),
		];
		const result = renderExistingCardsBlock(cards);
		expect(result).toContain("- Q: What is rosacea? | A: Skin reddening");
		expect(result).toContain(
			"- Q: When is phase 2 close? | A: When last 20% of effort yields <5%",
		);
	});

	it("caps the rendered list at EXISTING_CARDS_MAX_COUNT (oldest dropped first)", () => {
		const cards: ExistingCardContext[] = Array.from({ length: 60 }, (_, i) =>
			makeCard(String(i), `Q${i}`, `A${i}`),
		);
		const result = renderExistingCardsBlock(cards);
		expect(result).toContain("- Q: Q0 | A: A0");
		expect(result).toContain(
			`- Q: Q${EXISTING_CARDS_MAX_COUNT - 1} | A: A${EXISTING_CARDS_MAX_COUNT - 1}`,
		);
		expect(result).not.toContain(
			`- Q: Q${EXISTING_CARDS_MAX_COUNT} | A: A${EXISTING_CARDS_MAX_COUNT}`,
		);
	});

	it("truncates further when estimated tokens exceed EXISTING_CARDS_MAX_TOKENS", () => {
		const longCard = "x".repeat(400);
		const cards: ExistingCardContext[] = Array.from({ length: 50 }, (_, i) =>
			makeCard(String(i), longCard, longCard),
		);
		const result = renderExistingCardsBlock(cards);
		const estimatedTokens = Math.ceil(result.length / 4);
		expect(estimatedTokens).toBeLessThanOrEqual(EXISTING_CARDS_MAX_TOKENS + 50);
	});

	it("escapes pipe characters in question and answer so bullets parse cleanly", () => {
		const cards = [makeCard("1", "Q with | pipe", "A with | pipe")];
		const result = renderExistingCardsBlock(cards);
		expect(result).toContain("Q with \\| pipe");
		expect(result).toContain("A with \\| pipe");
	});
});
