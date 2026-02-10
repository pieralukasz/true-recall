import { describe, it, expect } from "vitest";
import { groupCards, type PanelItem } from "../../../src/ui/flashcard-panel/group-cards";
import type { FlashcardItem } from "../../../src/types";
import { renderClozeQuestion, renderClozeAnswer } from "../../../src/services/flashcard/cloze-parser.service";

// ── Helpers ──────────────────────────────────────────────────

function basicCard(id: string, q = "Q", a = "A"): FlashcardItem {
	return { id, question: q, answer: a };
}

function clozeCard(id: string, template: string, index: number): FlashcardItem {
	return {
		id,
		question: renderClozeQuestion(template, index),
		answer: renderClozeAnswer(template, index),
		cardType: "cloze",
		clozeTemplate: template,
		clozeIndex: index,
	};
}

function reversedCard(id: string, originalId: string, q = "Reversed Q", a = "Reversed A"): FlashcardItem {
	return {
		id,
		question: q,
		answer: a,
		cardType: "reversed",
		reverseOfBatchId: originalId,
	};
}

// Helper to extract types from result
function types(result: PanelItem[]): string[] {
	return result.map((item) => item.type);
}

// ── Tests ────────────────────────────────────────────────────

describe("groupCards", () => {
	// ── Empty / Basics ──────────────────────────────────────

	describe("empty and basic cards", () => {
		it("returns empty array for empty input", () => {
			expect(groupCards([])).toEqual([]);
		});

		it("returns single basic card", () => {
			const card = basicCard("1", "What is 2+2?", "4");
			const result = groupCards([card]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("basic");
			expect((result[0] as { type: "basic"; card: FlashcardItem }).card).toBe(card);
		});

		it("returns multiple basic cards in order", () => {
			const cards = [basicCard("a"), basicCard("b"), basicCard("c")];
			const result = groupCards(cards);

			expect(result).toHaveLength(3);
			expect(types(result)).toEqual(["basic", "basic", "basic"]);
			expect((result[0] as { type: "basic"; card: FlashcardItem }).card.id).toBe("a");
			expect((result[1] as { type: "basic"; card: FlashcardItem }).card.id).toBe("b");
			expect((result[2] as { type: "basic"; card: FlashcardItem }).card.id).toBe("c");
		});

		it("treats card without cardType as basic", () => {
			const card: FlashcardItem = { id: "1", question: "Q", answer: "A" };
			const result = groupCards([card]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("basic");
		});

		it("treats card with cardType 'basic' as basic", () => {
			const card: FlashcardItem = { id: "1", question: "Q", answer: "A", cardType: "basic" };
			const result = groupCards([card]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("basic");
		});
	});

	// ── Cloze Grouping ──────────────────────────────────────

	describe("cloze grouping", () => {
		const TEMPLATE = "{{c1::France}} is in {{c2::Europe}}";

		it("groups single cloze card into a cloze-group", () => {
			const card = clozeCard("c1", TEMPLATE, 1);
			const result = groupCards([card]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("cloze-group");
			const group = result[0] as { type: "cloze-group"; template: string; cards: FlashcardItem[] };
			expect(group.cards).toHaveLength(1);
			expect(group.template).toBe(TEMPLATE);
		});

		it("groups 2 cloze cards with same template", () => {
			const cards = [clozeCard("c1", TEMPLATE, 1), clozeCard("c2", TEMPLATE, 2)];
			const result = groupCards(cards);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("cloze-group");
			const group = result[0] as { type: "cloze-group"; template: string; cards: FlashcardItem[] };
			expect(group.cards).toHaveLength(2);
			expect(group.cards[0]!.clozeIndex).toBe(1);
			expect(group.cards[1]!.clozeIndex).toBe(2);
		});

		it("groups 3 cloze cards with same template", () => {
			const template3 = "{{c1::A}} {{c2::B}} {{c3::C}}";
			const cards = [
				clozeCard("c1", template3, 1),
				clozeCard("c2", template3, 2),
				clozeCard("c3", template3, 3),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(1);
			const group = result[0] as { type: "cloze-group"; template: string; cards: FlashcardItem[] };
			expect(group.cards).toHaveLength(3);
		});

		it("creates separate groups for different templates", () => {
			const template1 = "{{c1::Tokyo}} is in {{c2::Japan}}";
			const template2 = "{{c1::Berlin}} is in {{c2::Germany}}";
			const cards = [
				clozeCard("t1c1", template1, 1),
				clozeCard("t1c2", template1, 2),
				clozeCard("t2c1", template2, 1),
				clozeCard("t2c2", template2, 2),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(2);
			expect(types(result)).toEqual(["cloze-group", "cloze-group"]);

			const group1 = result[0] as { type: "cloze-group"; template: string; cards: FlashcardItem[] };
			const group2 = result[1] as { type: "cloze-group"; template: string; cards: FlashcardItem[] };
			expect(group1.template).toBe(template1);
			expect(group1.cards).toHaveLength(2);
			expect(group2.template).toBe(template2);
			expect(group2.cards).toHaveLength(2);
		});

		it("treats cloze card without clozeTemplate as basic", () => {
			const card: FlashcardItem = {
				id: "1",
				question: "Q",
				answer: "A",
				cardType: "cloze",
				// no clozeTemplate
			};
			const result = groupCards([card]);

			expect(result).toHaveLength(1);
			// Without clozeTemplate, it doesn't match the cloze branch
			// but cardType is "cloze" with no template → falls through to basic check
			// Since processedIds doesn't contain it (no template match), it's basic
			expect(result[0]!.type).toBe("basic");
		});

		it("treats card with clozeTemplate but not cardType=cloze as basic", () => {
			const card: FlashcardItem = {
				id: "1",
				question: "Q",
				answer: "A",
				clozeTemplate: TEMPLATE,
				// no cardType="cloze"
			};
			const result = groupCards([card]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("basic");
		});

		it("preserves exact template string in group", () => {
			const template = "The capital of {{c1::France}} is {{c2::Paris}}, located in {{c3::Europe}}";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; template: string; cards: FlashcardItem[] };
			expect(group.template).toBe(template);
		});

		it("handles cloze card with index 0", () => {
			const template = "{{c0::Zero}} based";
			const card = clozeCard("c0", template, 0);
			const result = groupCards([card]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("cloze-group");
		});
	});

	// ── Reverse Grouping ────────────────────────────────────

	describe("reverse grouping", () => {
		it("groups original + reversed pair", () => {
			const original = basicCard("orig", "What is X?", "Definition");
			const reversed = reversedCard("rev", "orig", "Definition", "What is X?");
			const result = groupCards([original, reversed]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("reverse-group");
			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.id).toBe("orig");
			expect(group.reversed.id).toBe("rev");
		});

		it("treats original without reversed card as basic", () => {
			const original = basicCard("orig", "What is X?", "Definition");
			const result = groupCards([original]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("basic");
		});

		it("skips reversed card without matching original in input", () => {
			const reversed = reversedCard("rev", "non-existent", "Q", "A");
			const result = groupCards([reversed]);

			// Reversed card is added to processedIds and skipped in the main loop
			expect(result).toHaveLength(0);
		});

		it("groups multiple reverse pairs independently", () => {
			const orig1 = basicCard("orig1", "Q1", "A1");
			const rev1 = reversedCard("rev1", "orig1", "A1", "Q1");
			const orig2 = basicCard("orig2", "Q2", "A2");
			const rev2 = reversedCard("rev2", "orig2", "A2", "Q2");

			const result = groupCards([orig1, rev1, orig2, rev2]);

			expect(result).toHaveLength(2);
			expect(types(result)).toEqual(["reverse-group", "reverse-group"]);
		});

		it("handles reversed card appearing before original in input", () => {
			const original = basicCard("orig", "What is X?", "Definition");
			const reversed = reversedCard("rev", "orig", "Definition", "What is X?");
			// Reversed appears first
			const result = groupCards([reversed, original]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("reverse-group");
			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.id).toBe("orig");
			expect(group.reversed.id).toBe("rev");
		});
	});

	// ── Mixed Types ─────────────────────────────────────────

	describe("mixed card types", () => {
		const CLOZE_TEMPLATE = "{{c1::Tokyo}} is the capital of {{c2::Japan}}";

		it("handles basic + cloze group", () => {
			const cards = [
				basicCard("basic1", "Simple Q", "Simple A"),
				clozeCard("c1", CLOZE_TEMPLATE, 1),
				clozeCard("c2", CLOZE_TEMPLATE, 2),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(2);
			expect(types(result)).toEqual(["basic", "cloze-group"]);
		});

		it("handles basic + reverse pair", () => {
			const cards = [
				basicCard("basic1"),
				basicCard("orig", "What?", "Answer"),
				reversedCard("rev", "orig", "Answer", "What?"),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(2);
			expect(types(result)).toEqual(["basic", "reverse-group"]);
		});

		it("handles all three types together", () => {
			const cards = [
				basicCard("basic1"),
				clozeCard("c1", CLOZE_TEMPLATE, 1),
				clozeCard("c2", CLOZE_TEMPLATE, 2),
				basicCard("orig", "What?", "Answer"),
				reversedCard("rev", "orig", "Answer", "What?"),
				basicCard("basic2"),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(4);
			expect(types(result)).toEqual(["basic", "cloze-group", "reverse-group", "basic"]);
		});

		it("handles complex mix: 2 cloze groups + 3 basics + 1 reverse pair", () => {
			const template1 = "{{c1::A}} and {{c2::B}}";
			const template2 = "{{c1::X}} or {{c2::Y}}";

			const cards = [
				basicCard("b1"),
				clozeCard("t1c1", template1, 1),
				basicCard("b2"),
				clozeCard("t1c2", template1, 2),
				basicCard("orig", "Q", "A"),
				reversedCard("rev", "orig", "A", "Q"),
				clozeCard("t2c1", template2, 1),
				basicCard("b3"),
				clozeCard("t2c2", template2, 2),
			];
			const result = groupCards(cards);

			expect(types(result)).toEqual([
				"basic",       // b1
				"cloze-group", // template1 (c1 first encounter)
				"basic",       // b2
				"reverse-group", // orig
				"cloze-group", // template2 (t2c1 first encounter)
				"basic",       // b3
			]);

			// Verify cloze group contents
			const clozeGroup1 = result[1] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(clozeGroup1.cards).toHaveLength(2);
			const clozeGroup2 = result[4] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(clozeGroup2.cards).toHaveLength(2);
		});

		it("handles interleaved cloze cards from same template", () => {
			const template = "{{c1::A}} {{c2::B}} {{c3::C}}";
			const cards = [
				basicCard("b1"),
				clozeCard("c1", template, 1),
				basicCard("b2"),
				clozeCard("c2", template, 2),
				basicCard("b3"),
				clozeCard("c3", template, 3),
			];
			const result = groupCards(cards);

			// Cloze group emitted at first cloze card's position
			expect(types(result)).toEqual(["basic", "cloze-group", "basic", "basic"]);

			const group = result[1] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards).toHaveLength(3);
		});
	});

	// ── Ordering / Position ─────────────────────────────────

	describe("ordering and position", () => {
		it("cloze group emitted at position of first cloze card", () => {
			const template = "{{c1::A}} {{c2::B}}";
			const cards = [
				basicCard("b1"),
				basicCard("b2"),
				clozeCard("c1", template, 1),
				basicCard("b3"),
				clozeCard("c2", template, 2),
			];
			const result = groupCards(cards);

			expect(types(result)).toEqual(["basic", "basic", "cloze-group", "basic"]);
		});

		it("reverse group emitted at position of original card", () => {
			const cards = [
				basicCard("b1"),
				basicCard("orig", "Q", "A"),
				basicCard("b2"),
				reversedCard("rev", "orig", "A", "Q"),
			];
			const result = groupCards(cards);

			expect(types(result)).toEqual(["basic", "reverse-group", "basic"]);
		});

		it("does not duplicate cloze groups (same template emitted once)", () => {
			const template = "{{c1::A}} {{c2::B}}";
			const cards = [
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
				clozeCard("c1dup", template, 1), // duplicate index
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("cloze-group");
			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards).toHaveLength(3); // all 3 cards in one group
		});

		it("does not duplicate reverse groups", () => {
			const original = basicCard("orig", "Q", "A");
			const reversed = reversedCard("rev", "orig", "A", "Q");
			const result = groupCards([original, reversed, original]); // duplicate original

			// The second original won't match again because emittedReverseOriginals tracks it
			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("reverse-group");
		});
	});

	// ── Edge Cases ──────────────────────────────────────────

	describe("edge cases", () => {
		it("handles card with empty string id", () => {
			const card = basicCard("", "Q", "A");
			const result = groupCards([card]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("basic");
		});

		it("handles cloze card with very long template string", () => {
			const longTemplate = "{{c1::" + "a".repeat(10000) + "}} and {{c2::short}}";
			const cards = [
				clozeCard("c1", longTemplate, 1),
				clozeCard("c2", longTemplate, 2),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("cloze-group");
			const group = result[0] as { type: "cloze-group"; template: string; cards: FlashcardItem[] };
			expect(group.cards).toHaveLength(2);
		});

		it("cloze card with reverseOfBatchId: cloze takes priority", () => {
			const template = "{{c1::A}} {{c2::B}}";
			const card: FlashcardItem = {
				id: "hybrid",
				question: "[...] B",
				answer: "**A** B",
				cardType: "cloze",
				clozeTemplate: template,
				clozeIndex: 1,
				reverseOfBatchId: "some-original", // also has reverse link
			};
			const result = groupCards([card]);

			// cardType="cloze" with clozeTemplate → processed as cloze, not reverse
			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("cloze-group");
		});

		it("handles all cards being cloze (no basics)", () => {
			const template = "{{c1::A}} {{c2::B}} {{c3::C}}";
			const cards = [
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
				clozeCard("c3", template, 3),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(1);
			expect(types(result)).toEqual(["cloze-group"]);
		});

		it("handles all cards being reversed (orphaned without originals)", () => {
			const cards = [
				reversedCard("r1", "missing1"),
				reversedCard("r2", "missing2"),
				reversedCard("r3", "missing3"),
			];
			const result = groupCards(cards);

			// All reversed cards skip (originals not in input)
			expect(result).toHaveLength(0);
		});

		it("handles 100+ cards efficiently", () => {
			const cards: FlashcardItem[] = [];
			for (let i = 0; i < 50; i++) {
				cards.push(basicCard(`basic-${i}`));
			}
			const template = "{{c1::A}} and {{c2::B}}";
			for (let i = 0; i < 25; i++) {
				cards.push(clozeCard(`cloze-${i}-1`, `{{c1::T${i}A}} {{c2::T${i}B}}`, 1));
				cards.push(clozeCard(`cloze-${i}-2`, `{{c1::T${i}A}} {{c2::T${i}B}}`, 2));
			}

			const result = groupCards(cards);

			// 50 basics + 25 cloze groups
			expect(result).toHaveLength(75);
		});
	});

	// ── Post-edit Scenarios ─────────────────────────────────

	describe("post-edit scenarios", () => {
		it("re-grouping after adding a cloze index to template", () => {
			// Before edit: 2 cloze cards
			const oldTemplate = "{{c1::France}} is in {{c2::Europe}}";
			const cardsBeforeEdit = [
				clozeCard("c1", oldTemplate, 1),
				clozeCard("c2", oldTemplate, 2),
			];
			const beforeResult = groupCards(cardsBeforeEdit);
			expect(beforeResult).toHaveLength(1);
			expect((beforeResult[0] as { type: "cloze-group"; cards: FlashcardItem[] }).cards).toHaveLength(2);

			// After edit: 3 cloze cards (c3 added)
			const newTemplate = "{{c1::France}} is in {{c2::Europe}}, specifically {{c3::Western Europe}}";
			const cardsAfterEdit = [
				clozeCard("c1", newTemplate, 1),
				clozeCard("c2", newTemplate, 2),
				clozeCard("c3-new", newTemplate, 3),
			];
			const afterResult = groupCards(cardsAfterEdit);
			expect(afterResult).toHaveLength(1);
			expect((afterResult[0] as { type: "cloze-group"; cards: FlashcardItem[] }).cards).toHaveLength(3);
		});

		it("re-grouping after removing a cloze index from template", () => {
			// Before: 3 cloze cards
			const oldTemplate = "{{c1::A}} {{c2::B}} {{c3::C}}";
			const cardsBeforeEdit = [
				clozeCard("c1", oldTemplate, 1),
				clozeCard("c2", oldTemplate, 2),
				clozeCard("c3", oldTemplate, 3),
			];
			const beforeResult = groupCards(cardsBeforeEdit);
			expect((beforeResult[0] as { type: "cloze-group"; cards: FlashcardItem[] }).cards).toHaveLength(3);

			// After: c3 removed (only 2 cards left)
			const newTemplate = "{{c1::A}} {{c2::B}}";
			const cardsAfterEdit = [
				clozeCard("c1", newTemplate, 1),
				clozeCard("c2", newTemplate, 2),
			];
			const afterResult = groupCards(cardsAfterEdit);
			expect(afterResult).toHaveLength(1);
			expect((afterResult[0] as { type: "cloze-group"; cards: FlashcardItem[] }).cards).toHaveLength(2);
		});

		it("reverse pair survives question edit (same IDs, different content)", () => {
			const original: FlashcardItem = {
				id: "orig",
				question: "New question text",
				answer: "Same answer",
			};
			const reversed: FlashcardItem = {
				id: "rev",
				question: "Same answer",
				answer: "New question text",
				cardType: "reversed",
				reverseOfBatchId: "orig",
			};
			const result = groupCards([original, reversed]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("reverse-group");
			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.question).toBe("New question text");
			expect(group.reversed.question).toBe("Same answer");
		});

		it("cloze group template changes are reflected in group", () => {
			// Simulates what happens after updateClozeTemplate() re-derives Q/A
			const newTemplate = "{{c1::Paris}} is beautiful";
			const cards = [
				clozeCard("c1", newTemplate, 1),
			];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; template: string; cards: FlashcardItem[] };
			expect(group.template).toBe(newTemplate);
			expect(group.cards[0]!.question).toBe("[...] is beautiful");
			expect(group.cards[0]!.answer).toBe("**Paris** is beautiful");
		});

		it("handles transition: basic card becomes part of a reverse pair", () => {
			// Step 1: single basic card
			const beforeCards = [basicCard("orig", "What?", "Answer")];
			const beforeResult = groupCards(beforeCards);
			expect(types(beforeResult)).toEqual(["basic"]);

			// Step 2: reversed card added
			const afterCards = [
				basicCard("orig", "What?", "Answer"),
				reversedCard("rev", "orig", "Answer", "What?"),
			];
			const afterResult = groupCards(afterCards);
			expect(types(afterResult)).toEqual(["reverse-group"]);
		});
	});

	// ── Realistic Data ──────────────────────────────────────

	describe("realistic flashcard scenarios", () => {
		it("language learning note: mixed cloze + basic + reverse", () => {
			const vocabTemplate = "{{c1::Bonjour}} means {{c2::Hello}} in French";
			const cards: FlashcardItem[] = [
				// Cloze group: vocabulary
				clozeCard("vocab-c1", vocabTemplate, 1),
				clozeCard("vocab-c2", vocabTemplate, 2),
				// Reverse pair: conjugation
				{ id: "conj-orig", question: "Je suis = ?", answer: "I am", cardType: "basic" as const },
				{ id: "conj-rev", question: "I am", answer: "Je suis = ?", cardType: "reversed" as const, reverseOfBatchId: "conj-orig" },
				// Plain basic card
				basicCard("grammar-note", "What is the passé composé?", "A past tense formed with avoir/être + past participle"),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(3);
			expect(types(result)).toEqual(["cloze-group", "reverse-group", "basic"]);

			const clozeGroup = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(clozeGroup.cards).toHaveLength(2);

			const reverseGroup = result[1] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(reverseGroup.original.id).toBe("conj-orig");
			expect(reverseGroup.reversed.id).toBe("conj-rev");
		});

		it("science note: multiple cloze templates", () => {
			const template1 = "Water boils at {{c1::100}}°C and freezes at {{c2::0}}°C";
			const template2 = "{{c1::H2O}} is the chemical formula for {{c2::water}}";
			const cards: FlashcardItem[] = [
				clozeCard("temp-c1", template1, 1),
				clozeCard("temp-c2", template1, 2),
				clozeCard("chem-c1", template2, 1),
				clozeCard("chem-c2", template2, 2),
				basicCard("extra", "What is the pH of pure water?", "7"),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(3);
			expect(types(result)).toEqual(["cloze-group", "cloze-group", "basic"]);
		});

		it("single cloze deletion (only c1) is still grouped", () => {
			const template = "The answer is {{c1::42}}";
			const cards = [clozeCard("c1", template, 1)];
			const result = groupCards(cards);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("cloze-group");
			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards).toHaveLength(1);
		});

		it("cloze with hints renders correctly in group", () => {
			const template = "{{c1::Paris::capital}} is in {{c2::France::country}}";
			const cards = [
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
			];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[capital] is in France");
			expect(group.cards[1]!.question).toBe("Paris is in [country]");
		});
	});

	// ── Cloze Formatting Verification ──────────────────────

	describe("cloze formatting: question rendering", () => {
		it("replaces target cloze with [...] placeholder", () => {
			const template = "{{c1::Tokyo}} is the capital of Japan";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] is the capital of Japan");
		});

		it("reveals non-target clozes as plain text", () => {
			const template = "{{c1::Tokyo}} is the capital of {{c2::Japan}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			// c1 question: Tokyo hidden, Japan revealed
			expect(group.cards[0]!.question).toBe("[...] is the capital of Japan");
			// c2 question: Tokyo revealed, Japan hidden
			expect(group.cards[1]!.question).toBe("Tokyo is the capital of [...]");
		});

		it("uses hint text in brackets when hint is provided", () => {
			const template = "{{c1::mitochondria::organelle}} is the powerhouse of the cell";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[organelle] is the powerhouse of the cell");
		});

		it("handles hint on one cloze and no hint on another", () => {
			const template = "{{c1::Paris::capital}} is in {{c2::France}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[capital] is in France");
			expect(group.cards[1]!.question).toBe("Paris is in [...]");
		});

		it("handles multiple occurrences of same cloze index", () => {
			const template = "{{c1::H2O}} is also known as {{c1::water}}";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] is also known as [...]");
		});

		it("preserves surrounding markdown in question", () => {
			const template = "The **important** compound {{c1::H2O}} has _unique_ properties";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("The **important** compound [...] has _unique_ properties");
		});

		it("handles cloze content with markdown formatting", () => {
			const template = "{{c1::**bold text**}} is formatted";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] is formatted");
		});

		it("handles three clozes with sequential reveal", () => {
			const template = "{{c1::A}} then {{c2::B}} then {{c3::C}}";
			const cards = [
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
				clozeCard("c3", template, 3),
			];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] then B then C");
			expect(group.cards[1]!.question).toBe("A then [...] then C");
			expect(group.cards[2]!.question).toBe("A then B then [...]");
		});

		it("handles cloze with empty text", () => {
			const template = "{{c1::}} is empty";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] is empty");
		});

		it("handles cloze with special characters", () => {
			const template = "{{c1::C++}} is a {{c2::programming language}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] is a programming language");
			expect(group.cards[1]!.question).toBe("C++ is a [...]");
		});

		it("handles cloze with numbers and math", () => {
			const template = "{{c1::2 + 2}} equals {{c2::4}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] equals 4");
			expect(group.cards[1]!.question).toBe("2 + 2 equals [...]");
		});

		it("handles cloze with inline code", () => {
			const template = "The function {{c1::`Array.map()`}} transforms elements";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("The function [...] transforms elements");
		});
	});

	describe("cloze formatting: answer rendering", () => {
		it("shows target cloze text in bold", () => {
			const template = "{{c1::Tokyo}} is the capital of Japan";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.answer).toBe("**Tokyo** is the capital of Japan");
		});

		it("reveals non-target clozes without bold in answer", () => {
			const template = "{{c1::Tokyo}} is the capital of {{c2::Japan}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.answer).toBe("**Tokyo** is the capital of Japan");
			expect(group.cards[1]!.answer).toBe("Tokyo is the capital of **Japan**");
		});

		it("bolds all occurrences of same index in answer", () => {
			const template = "{{c1::H2O}} is also known as {{c1::water}}";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.answer).toBe("**H2O** is also known as **water**");
		});

		it("answer ignores hint and shows actual text", () => {
			const template = "{{c1::Paris::capital}} is in {{c2::France::country}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.answer).toBe("**Paris** is in France");
			expect(group.cards[1]!.answer).toBe("Paris is in **France**");
		});

		it("preserves surrounding markdown in answer", () => {
			const template = "The _key_ fact: {{c1::mitochondria}} generates ATP";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.answer).toBe("The _key_ fact: **mitochondria** generates ATP");
		});

		it("three clozes: each answer bolds only its target", () => {
			const template = "{{c1::A}} then {{c2::B}} then {{c3::C}}";
			const cards = [
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
				clozeCard("c3", template, 3),
			];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.answer).toBe("**A** then B then C");
			expect(group.cards[1]!.answer).toBe("A then **B** then C");
			expect(group.cards[2]!.answer).toBe("A then B then **C**");
		});

		it("handles cloze with empty text in answer", () => {
			const template = "{{c1::}} is empty";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.answer).toBe("**** is empty");
		});
	});

	describe("cloze formatting: question and answer consistency", () => {
		it("question hides what answer reveals for each card in group", () => {
			const template = "{{c1::Tokyo}} is in {{c2::Japan}} in {{c3::Asia}}";
			const cards = [
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
				clozeCard("c3", template, 3),
			];
			const result = groupCards(cards);
			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };

			// Each card's question hides exactly one thing, answer bolds exactly that thing
			expect(group.cards[0]!.question).toContain("[...]");
			expect(group.cards[0]!.answer).toContain("**Tokyo**");
			expect(group.cards[0]!.question).not.toContain("Tokyo");

			expect(group.cards[1]!.question).toContain("[...]");
			expect(group.cards[1]!.answer).toContain("**Japan**");
			expect(group.cards[1]!.question).not.toContain("Japan");

			expect(group.cards[2]!.question).toContain("[...]");
			expect(group.cards[2]!.answer).toContain("**Asia**");
			expect(group.cards[2]!.question).not.toContain("Asia");
		});

		it("non-target clozes appear as plain text in both Q and A", () => {
			const template = "{{c1::dog}} and {{c2::cat}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);
			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };

			// c1 card: "cat" is non-target, appears plain in both Q and A
			expect(group.cards[0]!.question).toContain("cat");
			expect(group.cards[0]!.answer).toContain("cat");
			expect(group.cards[0]!.answer).not.toContain("**cat**");

			// c2 card: "dog" is non-target, appears plain in both Q and A
			expect(group.cards[1]!.question).toContain("dog");
			expect(group.cards[1]!.answer).toContain("dog");
			expect(group.cards[1]!.answer).not.toContain("**dog**");
		});

		it("all cards in group share the same template", () => {
			const template = "{{c1::X}} and {{c2::Y}} and {{c3::Z}}";
			const cards = [
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
				clozeCard("c3", template, 3),
			];
			const result = groupCards(cards);
			const group = result[0] as { type: "cloze-group"; template: string; cards: FlashcardItem[] };

			expect(group.template).toBe(template);
			for (const card of group.cards) {
				expect(card.clozeTemplate).toBe(template);
			}
		});

		it("clozeIndex is preserved in grouped cards", () => {
			const template = "{{c1::first}} {{c2::second}} {{c3::third}}";
			const cards = [
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
				clozeCard("c3", template, 3),
			];
			const result = groupCards(cards);
			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };

			expect(group.cards[0]!.clozeIndex).toBe(1);
			expect(group.cards[1]!.clozeIndex).toBe(2);
			expect(group.cards[2]!.clozeIndex).toBe(3);
		});
	});

	// ── Reverse Card Content Verification ──────────────────

	describe("reverse card content", () => {
		it("preserves original Q/A through grouping", () => {
			const original = basicCard("orig", "What is photosynthesis?", "The process by which plants convert light to energy");
			const reversed = reversedCard("rev", "orig", "The process by which plants convert light to energy", "What is photosynthesis?");
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.question).toBe("What is photosynthesis?");
			expect(group.original.answer).toBe("The process by which plants convert light to energy");
		});

		it("preserves reversed Q/A (swapped) through grouping", () => {
			const original = basicCard("orig", "What is DNA?", "Deoxyribonucleic acid");
			const reversed = reversedCard("rev", "orig", "Deoxyribonucleic acid", "What is DNA?");
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.reversed.question).toBe("Deoxyribonucleic acid");
			expect(group.reversed.answer).toBe("What is DNA?");
		});

		it("Q↔A symmetry: reversed.question === original.answer", () => {
			const q = "Capital of France?";
			const a = "Paris";
			const original = basicCard("orig", q, a);
			const reversed = reversedCard("rev", "orig", a, q);
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.reversed.question).toBe(group.original.answer);
			expect(group.reversed.answer).toBe(group.original.question);
		});

		it("preserves markdown formatting in reversed content", () => {
			const q = "What does `Array.map()` do?";
			const a = "It creates a **new array** by calling a function on _every_ element";
			const original = basicCard("orig", q, a);
			const reversed = reversedCard("rev", "orig", a, q);
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.question).toBe("What does `Array.map()` do?");
			expect(group.reversed.question).toBe("It creates a **new array** by calling a function on _every_ element");
		});

		it("preserves multi-line content in reversed cards", () => {
			const q = "List the phases of mitosis";
			const a = "1. Prophase\n2. Metaphase\n3. Anaphase\n4. Telophase";
			const original = basicCard("orig", q, a);
			const reversed = reversedCard("rev", "orig", a, q);
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.reversed.question).toContain("1. Prophase");
			expect(group.reversed.question).toContain("4. Telophase");
		});

		it("preserves content with image references in reversed cards", () => {
			const q = "What is this diagram?\n![[cell-diagram.png]]";
			const a = "A eukaryotic cell";
			const original = basicCard("orig", q, a);
			const reversed = reversedCard("rev", "orig", a, q);
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.reversed.answer).toContain("![[cell-diagram.png]]");
		});

		it("reversed cards maintain separate IDs", () => {
			const original = basicCard("orig-123", "Q", "A");
			const reversed = reversedCard("rev-456", "orig-123", "A", "Q");
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.id).toBe("orig-123");
			expect(group.reversed.id).toBe("rev-456");
			expect(group.original.id).not.toBe(group.reversed.id);
		});

		it("reversed card's reverseOfBatchId references original's id", () => {
			const original = basicCard("orig", "Q", "A");
			const reversed = reversedCard("rev", "orig", "A", "Q");
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.reversed.reverseOfBatchId).toBe(group.original.id);
		});

		it("handles reverse pair where content has colons and special chars", () => {
			const q = "Define: O(n log n)";
			const a = "Time complexity: e.g. merge sort, heap sort";
			const original = basicCard("orig", q, a);
			const reversed = reversedCard("rev", "orig", a, q);
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.question).toBe("Define: O(n log n)");
			expect(group.reversed.question).toBe("Time complexity: e.g. merge sort, heap sort");
		});
	});

	// ── Post-Edit Scenarios (expanded) ─────────────────────

	describe("post-edit: cloze template modification", () => {
		it("adding 4th cloze index updates group size", () => {
			const newTemplate = "{{c1::A}} {{c2::B}} {{c3::C}} {{c4::D}}";
			const cards = [
				clozeCard("c1", newTemplate, 1),
				clozeCard("c2", newTemplate, 2),
				clozeCard("c3", newTemplate, 3),
				clozeCard("c4-new", newTemplate, 4),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(1);
			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards).toHaveLength(4);
			expect(group.cards[3]!.clozeIndex).toBe(4);
		});

		it("changed template text updates Q/A for all cards", () => {
			// Simulates updateClozeTemplate() changing "France" to "Italy"
			const newTemplate = "{{c1::Rome}} is the capital of {{c2::Italy}}";
			const cards = [
				clozeCard("c1", newTemplate, 1),
				clozeCard("c2", newTemplate, 2),
			];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] is the capital of Italy");
			expect(group.cards[0]!.answer).toBe("**Rome** is the capital of Italy");
			expect(group.cards[1]!.question).toBe("Rome is the capital of [...]");
			expect(group.cards[1]!.answer).toBe("Rome is the capital of **Italy**");
		});

		it("removing middle cloze index: remaining cards re-derive correctly", () => {
			// Had c1, c2, c3; removed c2
			const newTemplate = "{{c1::A}} and {{c3::C}}";
			const cards = [
				clozeCard("c1", newTemplate, 1),
				clozeCard("c3", newTemplate, 3),
			];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards).toHaveLength(2);
			expect(group.cards[0]!.question).toBe("[...] and C");
			expect(group.cards[1]!.question).toBe("A and [...]");
		});

		it("adding hint to existing cloze updates question format", () => {
			const newTemplate = "{{c1::Paris::city}} is beautiful";
			const cards = [clozeCard("c1", newTemplate, 1)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[city] is beautiful");
			// Answer still shows actual text
			expect(group.cards[0]!.answer).toBe("**Paris** is beautiful");
		});

		it("removing hint from cloze reverts to [...]", () => {
			const newTemplate = "{{c1::Paris}} is beautiful";
			const cards = [clozeCard("c1", newTemplate, 1)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] is beautiful");
		});
	});

	describe("post-edit: reverse pair editing", () => {
		it("editing original question updates group content", () => {
			// After edit: question changed, reversed card auto-synced
			const original = basicCard("orig", "Updated: what is X?", "Still the same answer");
			const reversed = reversedCard("rev", "orig", "Still the same answer", "Updated: what is X?");
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.question).toBe("Updated: what is X?");
			expect(group.reversed.answer).toBe("Updated: what is X?");
		});

		it("editing original answer syncs to reversed question", () => {
			const original = basicCard("orig", "What is X?", "New detailed answer");
			const reversed = reversedCard("rev", "orig", "New detailed answer", "What is X?");
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.answer).toBe("New detailed answer");
			expect(group.reversed.question).toBe("New detailed answer");
		});

		it("reverse pair dissolves when reversed card is removed", () => {
			// Only original remains after deletion of reversed
			const original = basicCard("orig", "What is X?", "Definition");
			const result = groupCards([original]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("basic");
			expect((result[0] as { type: "basic"; card: FlashcardItem }).card.question).toBe("What is X?");
		});

		it("reverse pair dissolves when original is removed (orphaned reversed)", () => {
			// Reversed card orphaned after original deletion
			const reversed = reversedCard("rev", "deleted-orig", "A", "Q");
			const result = groupCards([reversed]);

			// Orphaned reversed cards are skipped
			expect(result).toHaveLength(0);
		});
	});

	describe("post-edit: type transitions", () => {
		it("basic card gains cloze template: becomes cloze group", () => {
			// Before: basic card. After: converted to cloze
			const template = "{{c1::Tokyo}} is in {{c2::Japan}}";
			const cards = [
				clozeCard("was-basic", template, 1),
				clozeCard("new-sibling", template, 2),
			];
			const result = groupCards(cards);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("cloze-group");
		});

		it("cloze loses template: reverts to basic", () => {
			// Card still has cardType: "cloze" but no clozeTemplate
			const card: FlashcardItem = {
				id: "was-cloze",
				question: "Orphaned cloze question",
				answer: "Some answer",
				cardType: "cloze",
				// deliberately no clozeTemplate
			};
			const result = groupCards([card]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("basic");
		});

		it("basic card gains reverse: transitions to reverse-group", () => {
			const original = basicCard("orig", "Q", "A");
			const reversed = reversedCard("new-rev", "orig", "A", "Q");
			const result = groupCards([original, reversed]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("reverse-group");
		});

		it("two separate basics remain when given different reverseOfBatchIds", () => {
			const card1 = basicCard("b1", "Q1", "A1");
			const card2 = basicCard("b2", "Q2", "A2");
			const rev1 = reversedCard("r1", "nonexistent1", "A1", "Q1");
			const rev2 = reversedCard("r2", "nonexistent2", "A2", "Q2");
			const result = groupCards([card1, card2, rev1, rev2]);

			// Reversed cards pointing to nonexistent originals are skipped
			expect(result).toHaveLength(2);
			expect(types(result)).toEqual(["basic", "basic"]);
		});
	});

	// ── Stability / Idempotency ────────────────────────────

	describe("stability and idempotency", () => {
		it("calling groupCards twice with same input produces identical output", () => {
			const template = "{{c1::A}} and {{c2::B}}";
			const cards = [
				basicCard("b1"),
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
				basicCard("orig", "Q", "A"),
				reversedCard("rev", "orig", "A", "Q"),
			];

			const result1 = groupCards(cards);
			const result2 = groupCards(cards);

			expect(result1).toEqual(result2);
		});

		it("does not mutate the input array", () => {
			const template = "{{c1::X}} {{c2::Y}}";
			const cards = [
				basicCard("b1"),
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
			];
			const originalLength = cards.length;
			const originalIds = cards.map((c) => c.id);

			groupCards(cards);

			expect(cards).toHaveLength(originalLength);
			expect(cards.map((c) => c.id)).toEqual(originalIds);
		});

		it("does not mutate individual card objects", () => {
			const card = basicCard("b1", "Original Q", "Original A");
			const cardCopy = { ...card };

			groupCards([card]);

			expect(card).toEqual(cardCopy);
		});

		it("output cards are the same object references (not cloned)", () => {
			const card = basicCard("b1", "Q", "A");
			const result = groupCards([card]);

			const basic = result[0] as { type: "basic"; card: FlashcardItem };
			expect(basic.card).toBe(card);
		});

		it("cloze group cards are same references as input", () => {
			const template = "{{c1::A}} {{c2::B}}";
			const c1 = clozeCard("c1", template, 1);
			const c2 = clozeCard("c2", template, 2);
			const result = groupCards([c1, c2]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]).toBe(c1);
			expect(group.cards[1]).toBe(c2);
		});

		it("reverse group cards are same references as input", () => {
			const original = basicCard("orig", "Q", "A");
			const reversed = reversedCard("rev", "orig", "A", "Q");
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original).toBe(original);
			expect(group.reversed).toBe(reversed);
		});
	});

	// ── Group ID Patterns ──────────────────────────────────

	describe("group identification patterns", () => {
		it("cloze group can be identified by first card ID (panel uses 'cloze:' prefix)", () => {
			const template = "{{c1::A}} {{c2::B}}";
			const cards = [clozeCard("first-card", template, 1), clozeCard("second-card", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			const groupId = `cloze:${group.cards[0]!.id}`;
			expect(groupId).toBe("cloze:first-card");
		});

		it("reverse group can be identified by original card ID (panel uses 'reverse:' prefix)", () => {
			const original = basicCard("orig-id", "Q", "A");
			const reversed = reversedCard("rev-id", "orig-id", "A", "Q");
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			const groupId = `reverse:${group.original.id}`;
			expect(groupId).toBe("reverse:orig-id");
		});

		it("cloze group ID changes when first card changes", () => {
			const template = "{{c1::A}} {{c2::B}}";
			// First call: c1 first
			const cards1 = [clozeCard("alpha", template, 1), clozeCard("beta", template, 2)];
			const result1 = groupCards(cards1);
			const group1 = result1[0] as { type: "cloze-group"; cards: FlashcardItem[] };

			// Second call: different first card (e.g., after adding a new c0)
			const cards2 = [clozeCard("new-first", template, 0), clozeCard("alpha", template, 1), clozeCard("beta", template, 2)];
			const result2 = groupCards(cards2);
			const group2 = result2[0] as { type: "cloze-group"; cards: FlashcardItem[] };

			expect(group1.cards[0]!.id).toBe("alpha");
			expect(group2.cards[0]!.id).toBe("new-first");
		});
	});

	// ── Complex / Real-World Templates ─────────────────────

	describe("complex template content", () => {
		it("cloze with simple LaTeX math notation (no braces in content)", () => {
			// Note: cloze regex [^}]*? stops at } chars, so LaTeX with braces
			// must be outside the cloze deletion, not inside it
			const template = "The formula $E=mc^2$ means {{c1::energy equals mass times speed of light squared}}";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("The formula $E=mc^2$ means [...]");
			expect(group.cards[0]!.answer).toContain("**energy equals mass times speed of light squared**");
		});

		it("cloze with multi-word content and punctuation", () => {
			const template = "{{c1::The United States of America}} was founded in {{c2::1776}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] was founded in 1776");
			expect(group.cards[0]!.answer).toBe("**The United States of America** was founded in 1776");
			expect(group.cards[1]!.question).toBe("The United States of America was founded in [...]");
			expect(group.cards[1]!.answer).toBe("The United States of America was founded in **1776**");
		});

		it("cloze content with pipe characters", () => {
			const template = "In a truth table, {{c1::AND}} uses {{c2::A | B}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("In a truth table, [...] uses A | B");
			expect(group.cards[1]!.question).toBe("In a truth table, AND uses [...]");
		});

		it("reverse pair with code block content", () => {
			const q = "What does this code do?\n```js\nconst x = [1,2,3].map(n => n * 2);\n```";
			const a = "Creates array `[2, 4, 6]` by doubling each element";
			const original = basicCard("orig", q, a);
			const reversed = reversedCard("rev", "orig", a, q);
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.question).toContain("```js");
			expect(group.reversed.answer).toContain("```js");
		});

		it("reverse pair with empty answer", () => {
			const original = basicCard("orig", "Question?", "");
			const reversed = reversedCard("rev", "orig", "", "Question?");
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.original.answer).toBe("");
			expect(group.reversed.question).toBe("");
		});

		it("reverse pair with unicode and emoji content", () => {
			const q = "How do you say hello in Japanese?";
			const a = "こんにちは (konnichiwa)";
			const original = basicCard("orig", q, a);
			const reversed = reversedCard("rev", "orig", a, q);
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.reversed.question).toBe("こんにちは (konnichiwa)");
			expect(group.reversed.answer).toBe("How do you say hello in Japanese?");
		});

		it("cloze with obsidian wiki-links in template", () => {
			const template = "{{c1::Obsidian}} uses [[Markdown]] for {{c2::note-taking}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] uses [[Markdown]] for note-taking");
			expect(group.cards[1]!.question).toBe("Obsidian uses [[Markdown]] for [...]");
		});

		it("cloze with HTML entities in template", () => {
			const template = "{{c1::&amp;}} represents the {{c2::ampersand}} character";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] represents the ampersand character");
			expect(group.cards[0]!.answer).toBe("**&amp;** represents the ampersand character");
		});
	});

	// ── Large-Scale Scenarios ──────────────────────────────

	describe("large-scale and stress tests", () => {
		it("handles 10 cloze indices in one template", () => {
			const parts = Array.from({ length: 10 }, (_, i) => `{{c${i + 1}::word${i + 1}}}`);
			const template = parts.join(" ");
			const cards = Array.from({ length: 10 }, (_, i) =>
				clozeCard(`c${i + 1}`, template, i + 1)
			);
			const result = groupCards(cards);

			expect(result).toHaveLength(1);
			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards).toHaveLength(10);

			// Each card should hide exactly one word
			for (let i = 0; i < 10; i++) {
				expect(group.cards[i]!.question).toContain("[...]");
				expect(group.cards[i]!.answer).toContain(`**word${i + 1}**`);
			}
		});

		it("handles 50 reverse pairs", () => {
			const cards: FlashcardItem[] = [];
			for (let i = 0; i < 50; i++) {
				cards.push(basicCard(`orig-${i}`, `Q${i}`, `A${i}`));
				cards.push(reversedCard(`rev-${i}`, `orig-${i}`, `A${i}`, `Q${i}`));
			}
			const result = groupCards(cards);

			expect(result).toHaveLength(50);
			expect(result.every((r) => r.type === "reverse-group")).toBe(true);
		});

		it("handles mix of 200 cards: basics + cloze + reverse", () => {
			const cards: FlashcardItem[] = [];

			// 50 basic cards
			for (let i = 0; i < 50; i++) {
				cards.push(basicCard(`basic-${i}`, `Basic Q${i}`, `Basic A${i}`));
			}

			// 25 cloze templates with 2 cards each = 50 cloze cards
			for (let i = 0; i < 25; i++) {
				const tmpl = `{{c1::X${i}}} and {{c2::Y${i}}}`;
				cards.push(clozeCard(`cloze-${i}-1`, tmpl, 1));
				cards.push(clozeCard(`cloze-${i}-2`, tmpl, 2));
			}

			// 50 reverse pairs = 100 cards
			for (let i = 0; i < 50; i++) {
				cards.push(basicCard(`rorig-${i}`, `RQ${i}`, `RA${i}`));
				cards.push(reversedCard(`rrev-${i}`, `rorig-${i}`, `RA${i}`, `RQ${i}`));
			}

			const result = groupCards(cards);

			// 50 basic + 25 cloze groups + 50 reverse groups = 125
			expect(result).toHaveLength(125);

			const basicCount = result.filter((r) => r.type === "basic").length;
			const clozeCount = result.filter((r) => r.type === "cloze-group").length;
			const reverseCount = result.filter((r) => r.type === "reverse-group").length;

			expect(basicCount).toBe(50);
			expect(clozeCount).toBe(25);
			expect(reverseCount).toBe(50);
		});
	});

	// ── Search/Filter Compatibility ────────────────────────

	describe("search filter compatibility", () => {
		// These tests verify that grouped items have the fields
		// needed by FlashcardPanelContent's search filter logic

		it("basic card has searchable question and answer", () => {
			const card = basicCard("b1", "Searchable question", "Findable answer");
			const result = groupCards([card]);

			const basic = result[0] as { type: "basic"; card: FlashcardItem };
			expect(basic.card.question.toLowerCase()).toContain("searchable");
			expect(basic.card.answer.toLowerCase()).toContain("findable");
		});

		it("cloze group cards have searchable Q/A for filtering", () => {
			const template = "{{c1::Photosynthesis}} occurs in {{c2::chloroplasts}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };

			// FlashcardPanelContent searches through all cards in a cloze group
			const searchable = group.cards.some(
				(c) => c.question.toLowerCase().includes("photosynthesis") || c.answer.toLowerCase().includes("photosynthesis")
			);
			expect(searchable).toBe(true);
		});

		it("reverse group has searchable fields on both original and reversed", () => {
			const original = basicCard("orig", "quantum entanglement", "spooky action at a distance");
			const reversed = reversedCard("rev", "orig", "spooky action at a distance", "quantum entanglement");
			const result = groupCards([original, reversed]);

			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };

			// Search for "quantum" should match
			const matchesOrigQ = group.original.question.toLowerCase().includes("quantum");
			const matchesRevA = group.reversed.answer.toLowerCase().includes("quantum");
			expect(matchesOrigQ).toBe(true);
			expect(matchesRevA).toBe(true);

			// Search for "spooky" should match
			const matchesOrigA = group.original.answer.toLowerCase().includes("spooky");
			const matchesRevQ = group.reversed.question.toLowerCase().includes("spooky");
			expect(matchesOrigA).toBe(true);
			expect(matchesRevQ).toBe(true);
		});

		it("cloze search finds hidden text via answer field", () => {
			const template = "{{c1::mitochondria}} is the powerhouse";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			// Question has "[...]" not "mitochondria"
			expect(group.cards[0]!.question).not.toContain("mitochondria");
			// But answer has it bold, so search can find it
			expect(group.cards[0]!.answer.toLowerCase()).toContain("mitochondria");
		});

		it("cloze search finds revealed (non-target) text via question field", () => {
			const template = "{{c1::Tokyo}} is in {{c2::Japan}}";
			const cards = [clozeCard("c1", template, 1), clozeCard("c2", template, 2)];
			const result = groupCards(cards);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			// Searching "Japan": c1's question has "Japan" revealed
			expect(group.cards[0]!.question.toLowerCase()).toContain("japan");
		});
	});

	// ── Boundary / Corner Cases ────────────────────────────

	describe("boundary and corner cases", () => {
		it("reversed card pointing to itself does not form a pair", () => {
			const card: FlashcardItem = {
				id: "self",
				question: "Q",
				answer: "A",
				cardType: "reversed",
				reverseOfBatchId: "self",
			};
			const result = groupCards([card]);

			// The card is "reversed" type, so it gets added to processedIds and skipped.
			// Since "self" is in reverseByOriginalId, the main loop will find a reverse pair
			// when processing "self" as the original. But the card's cardType is "reversed",
			// so it's skipped in the main loop before reaching the original check.
			expect(result).toHaveLength(0);
		});

		it("two reversed cards pointing to each other", () => {
			const card1: FlashcardItem = {
				id: "a",
				question: "Q1",
				answer: "A1",
				cardType: "reversed",
				reverseOfBatchId: "b",
			};
			const card2: FlashcardItem = {
				id: "b",
				question: "Q2",
				answer: "A2",
				cardType: "reversed",
				reverseOfBatchId: "a",
			};
			const result = groupCards([card1, card2]);

			// Both are cardType:"reversed", so both are skipped in main loop
			expect(result).toHaveLength(0);
		});

		it("reversed card with empty reverseOfBatchId is treated as basic", () => {
			const card: FlashcardItem = {
				id: "rev",
				question: "Q",
				answer: "A",
				cardType: "reversed",
				reverseOfBatchId: "",
			};
			const result = groupCards([card]);

			// Empty string is falsy, so the card doesn't enter the reverse indexing
			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("basic");
		});

		it("cloze card with undefined clozeIndex is still grouped by template", () => {
			const template = "{{c1::Test}} content";
			const card: FlashcardItem = {
				id: "c1",
				question: "[...] content",
				answer: "**Test** content",
				cardType: "cloze",
				clozeTemplate: template,
				// clozeIndex is undefined
			};
			const result = groupCards([card]);

			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("cloze-group");
		});

		it("multiple reversed cards pointing to same original: last one wins", () => {
			const original = basicCard("orig", "Q", "A");
			const rev1 = reversedCard("rev1", "orig", "A1", "Q1");
			const rev2 = reversedCard("rev2", "orig", "A2", "Q2");

			const result = groupCards([original, rev1, rev2]);

			// reverseByOriginalId is a Map, so last write wins
			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("reverse-group");
			const group = result[0] as { type: "reverse-group"; original: FlashcardItem; reversed: FlashcardItem };
			expect(group.reversed.id).toBe("rev2");
		});

		it("card with all type indicators: cloze wins over reverse", () => {
			const template = "{{c1::A}} and {{c2::B}}";
			const card: FlashcardItem = {
				id: "hybrid",
				question: "[...] and B",
				answer: "**A** and B",
				cardType: "cloze",
				clozeTemplate: template,
				clozeIndex: 1,
				reverseOfBatchId: "some-other",
			};
			const result = groupCards([card]);

			// Cloze indexed first, so card is in processedIds before reverse check
			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("cloze-group");
		});

		it("handles cloze template that looks like reverse syntax", () => {
			const template = "{{c1::reverseOfBatchId}} is a field name";
			const card = clozeCard("c1", template, 1);
			const result = groupCards([card]);

			const group = result[0] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards[0]!.question).toBe("[...] is a field name");
		});

		it("handles card with question containing cloze-like syntax (not actual cloze)", () => {
			const card = basicCard("b1", "What does {{c1::text}} mean in Anki?", "It's a cloze deletion");
			const result = groupCards([card]);

			// No cardType: "cloze", so treated as basic despite syntax in question
			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("basic");
		});
	});

	// ── Ordering Guarantees ────────────────────────────────

	describe("ordering guarantees with all types", () => {
		it("preserves relative order: basic, cloze group, reverse group, basic", () => {
			const template = "{{c1::A}} {{c2::B}}";
			const cards = [
				basicCard("b1", "First", "1"),
				clozeCard("c1", template, 1),
				clozeCard("c2", template, 2),
				basicCard("orig", "Q", "A"),
				reversedCard("rev", "orig", "A", "Q"),
				basicCard("b2", "Last", "2"),
			];
			const result = groupCards(cards);

			expect(types(result)).toEqual(["basic", "cloze-group", "reverse-group", "basic"]);

			// Verify content at each position
			expect((result[0] as { type: "basic"; card: FlashcardItem }).card.question).toBe("First");
			expect((result[3] as { type: "basic"; card: FlashcardItem }).card.question).toBe("Last");
		});

		it("interleaved cloze cards: group at first occurrence, skips rest", () => {
			const template = "{{c1::X}} {{c2::Y}} {{c3::Z}}";
			const cards = [
				basicCard("b1"),
				clozeCard("c2", template, 2),  // c2 comes first in array
				basicCard("b2"),
				clozeCard("c1", template, 1),  // c1 comes later
				clozeCard("c3", template, 3),
				basicCard("b3"),
			];
			const result = groupCards(cards);

			// Cloze group emitted at c2's position (first encountered)
			expect(types(result)).toEqual(["basic", "cloze-group", "basic", "basic"]);

			// But cards within group are in original array order
			const group = result[1] as { type: "cloze-group"; cards: FlashcardItem[] };
			expect(group.cards.map((c) => c.id)).toEqual(["c2", "c1", "c3"]);
		});

		it("reversed before original: group emitted at original position", () => {
			const cards = [
				basicCard("b1"),
				reversedCard("rev", "orig", "A", "Q"),
				basicCard("b2"),
				basicCard("orig", "Q", "A"),
				basicCard("b3"),
			];
			const result = groupCards(cards);

			// Reversed is skipped, group emitted when "orig" is encountered
			expect(types(result)).toEqual(["basic", "basic", "reverse-group", "basic"]);
		});
	});
});
