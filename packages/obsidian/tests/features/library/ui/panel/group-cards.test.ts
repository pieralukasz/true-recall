import type { FlashcardItem } from "@true-recall/core/types";
import { describe, expect, it } from "vitest";
import { groupCards } from "../../../../../src/features/library/ui/panel/group-cards";

function basicCard(id: string, q = "Q", a = "A"): FlashcardItem {
	return { id, question: q, answer: a };
}

function clozeCard(id: string, template: string, index: number): FlashcardItem {
	return {
		id,
		question: `Cloze Q ${index}`,
		answer: `Cloze A ${index}`,
		cardType: "cloze",
		clozeTemplate: template,
		clozeIndex: index,
	};
}

function reversedCard(id: string, originalId: string): FlashcardItem {
	return {
		id,
		question: "Reversed Q",
		answer: "Reversed A",
		cardType: "reversed",
		reverseOfBatchId: originalId,
	};
}

const emptyFsrsMap = new Map();

describe("groupCards (flat)", () => {
	it("returns empty array for empty input", () => {
		expect(groupCards([], emptyFsrsMap)).toEqual([]);
	});

	it("returns one item per card", () => {
		const cards = [basicCard("1"), basicCard("2"), basicCard("3")];
		const result = groupCards(cards, emptyFsrsMap);
		expect(result).toHaveLength(3);
		expect(result[0]!.card.id).toBe("1");
		expect(result[2]!.card.id).toBe("3");
	});

	it("does NOT group cloze cards — each is its own row", () => {
		const template = "{{c1::Tokyo}} is in {{c2::Japan}}";
		const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
		const result = groupCards(cards, emptyFsrsMap);
		expect(result).toHaveLength(2);
		expect(result[0]!.card.id).toBe("c1");
		expect(result[1]!.card.id).toBe("c2");
	});

	it("does NOT group reversed cards — each is its own row", () => {
		const original = basicCard("orig", "Front", "Back");
		const reversed = reversedCard("rev", "orig");
		const result = groupCards([original, reversed], emptyFsrsMap);
		expect(result).toHaveLength(2);
		expect(result[0]!.card.id).toBe("orig");
		expect(result[1]!.card.id).toBe("rev");
	});

	it("preserves card order", () => {
		const cards = [
			basicCard("1"),
			clozeCard("2", "tpl", 1),
			reversedCard("3", "x"),
			basicCard("4"),
		];
		const result = groupCards(cards, emptyFsrsMap);
		expect(result.map((r) => r.card.id)).toEqual(["1", "2", "3", "4"]);
	});
});
