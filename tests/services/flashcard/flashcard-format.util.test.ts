import { describe, it, expect } from "vitest";
import {
	cardToMarkdown,
	cardsToMarkdown,
	previewCards,
	extractClozeExtraAnswer,
	type CardLike,
	type CardPreview,
} from "../../../src/services/flashcard/flashcard-format.util";
import { renderClozeAnswer } from "../../../src/services/flashcard/cloze-parser.service";
import { FlashcardParserService } from "../../../src/services/flashcard/flashcard-parser.service";

// ── Helpers ──────────────────────────────────────────────

function basic(q: string, a: string, id = "b1"): CardLike & { id: string } {
	return { id, question: q, answer: a };
}

function cloze(
	template: string,
	index: number,
	extra = "",
	id = `c${index}`
): CardLike & { id: string } {
	const rendered = renderClozeAnswer(template, index);
	return {
		id,
		question: `cloze-q-${index}`,
		answer: extra ? `${rendered}\n\n${extra}` : rendered,
		cardType: "cloze" as const,
		clozeTemplate: template,
		clozeIndex: index,
	};
}

function reversed(
	origQ: string,
	origA: string,
	originalId = "orig",
	id = "rev"
): CardLike & { id: string } {
	return {
		id,
		question: origA,
		answer: origQ,
		cardType: "reversed" as const,
		reverseOfBatchId: originalId,
	};
}

// ── cardToMarkdown ──────────────────────────────────────

describe("cardToMarkdown", () => {
	describe("basic cards", () => {
		it("formats basic card with Q and A", () => {
			expect(cardToMarkdown(basic("What is X?", "Definition"))).toBe(
				"What is X? #flashcard\nDefinition"
			);
		});

		it("formats basic card with empty answer", () => {
			expect(cardToMarkdown(basic("What is X?", ""))).toBe(
				"What is X? #flashcard"
			);
		});

		it("treats card with no cardType as basic", () => {
			const card = { question: "Q", answer: "A" };
			expect(cardToMarkdown(card)).toBe("Q #flashcard\nA");
		});

		it("treats card with cardType 'basic' as basic", () => {
			const card = { question: "Q", answer: "A", cardType: "basic" as const };
			expect(cardToMarkdown(card)).toBe("Q #flashcard\nA");
		});

		it("preserves markdown formatting in question", () => {
			const card = basic("What does `Array.map()` do?", "Transforms elements");
			expect(cardToMarkdown(card)).toBe(
				"What does `Array.map()` do? #flashcard\nTransforms elements"
			);
		});

		it("preserves multi-line answer", () => {
			const card = basic("List phases", "1. Prophase\n2. Metaphase\n3. Anaphase");
			expect(cardToMarkdown(card)).toBe(
				"List phases #flashcard\n1. Prophase\n2. Metaphase\n3. Anaphase"
			);
		});

		it("preserves code blocks in answer", () => {
			const card = basic("What is this?", "```js\nconst x = 1;\n```");
			expect(cardToMarkdown(card)).toBe(
				"What is this? #flashcard\n```js\nconst x = 1;\n```"
			);
		});

		it("preserves wiki-links", () => {
			const card = basic("What is [[Obsidian]]?", "A note-taking app");
			expect(cardToMarkdown(card)).toBe(
				"What is [[Obsidian]]? #flashcard\nA note-taking app"
			);
		});

		it("preserves image references", () => {
			const card = basic("What is this?\n![[diagram.png]]", "A cell");
			expect(cardToMarkdown(card)).toBe(
				"What is this?\n![[diagram.png]] #flashcard\nA cell"
			);
		});
	});

	describe("cloze cards", () => {
		it("uses clozeTemplate instead of rendered question", () => {
			const card = cloze("{{c1::Tokyo}} is in {{c2::Japan}}", 1);
			const result = cardToMarkdown(card);
			expect(result).toBe("{{c1::Tokyo}} is in {{c2::Japan}} #flashcard");
		});

		it("includes extra answer text when present", () => {
			const card = cloze("{{c1::Tokyo}} is a city", 1, "Located on Honshu island");
			const result = cardToMarkdown(card);
			expect(result).toBe(
				"{{c1::Tokyo}} is a city #flashcard\nLocated on Honshu island"
			);
		});

		it("handles cloze with no extra answer", () => {
			const card = cloze("{{c1::Paris}} is beautiful", 1);
			const result = cardToMarkdown(card);
			expect(result).toBe("{{c1::Paris}} is beautiful #flashcard");
		});

		it("handles cloze with hints in template", () => {
			const card = cloze("{{c1::Paris::capital}} is in {{c2::France::country}}", 1);
			const result = cardToMarkdown(card);
			expect(result).toBe(
				"{{c1::Paris::capital}} is in {{c2::France::country}} #flashcard"
			);
		});

		it("cloze card without clozeTemplate falls back to basic format", () => {
			const card: CardLike = {
				question: "rendered Q",
				answer: "rendered A",
				cardType: "cloze",
				// no clozeTemplate
			};
			expect(cardToMarkdown(card)).toBe("rendered Q #flashcard\nrendered A");
		});

		it("preserves template with 3+ cloze indices", () => {
			const template = "{{c1::A}} then {{c2::B}} then {{c3::C}}";
			const card = cloze(template, 2);
			expect(cardToMarkdown(card)).toBe(`${template} #flashcard`);
		});
	});

	describe("reversed cards", () => {
		it("uses #flashcard-reverse tag with original Q/A", () => {
			// Reversed card stores: question=origA, answer=origQ
			const card = reversed("Capital of France?", "Paris");
			// Should output: "Capital of France? #flashcard-reverse\nParis"
			// Because reversed.answer = origQ, reversed.question = origA
			const result = cardToMarkdown(card);
			expect(result).toBe("Capital of France? #flashcard-reverse\nParis");
		});

		it("handles reversed card with empty original answer", () => {
			const card = reversed("Question?", "");
			const result = cardToMarkdown(card);
			expect(result).toBe("Question? #flashcard-reverse");
		});

		it("preserves markdown in reversed content", () => {
			const card = reversed("What does `map` do?", "It **transforms** elements");
			const result = cardToMarkdown(card);
			expect(result).toBe(
				"What does `map` do? #flashcard-reverse\nIt **transforms** elements"
			);
		});
	});
});

// ── cardsToMarkdown ─────────────────────────────────────

describe("cardsToMarkdown", () => {
	it("returns empty string for empty array", () => {
		expect(cardsToMarkdown([])).toBe("");
	});

	it("formats single basic card", () => {
		const cards = [basic("Q", "A")];
		expect(cardsToMarkdown(cards)).toBe("Q #flashcard\nA");
	});

	it("separates multiple basic cards with blank line", () => {
		const cards = [basic("Q1", "A1", "b1"), basic("Q2", "A2", "b2")];
		expect(cardsToMarkdown(cards)).toBe(
			"Q1 #flashcard\nA1\n\nQ2 #flashcard\nA2"
		);
	});

	describe("cloze deduplication", () => {
		it("outputs single cloze template for 2 siblings", () => {
			const template = "{{c1::Tokyo}} is in {{c2::Japan}}";
			const cards = [cloze(template, 1), cloze(template, 2)];
			const result = cardsToMarkdown(cards);

			expect(result).toBe(`${template} #flashcard`);
			// Only ONE block, not two
			expect(result.split("#flashcard").length - 1).toBe(1);
		});

		it("outputs single cloze template for 3 siblings", () => {
			const template = "{{c1::A}} {{c2::B}} {{c3::C}}";
			const cards = [cloze(template, 1), cloze(template, 2), cloze(template, 3)];
			const result = cardsToMarkdown(cards);

			expect(result).toBe(`${template} #flashcard`);
		});

		it("outputs separate blocks for different cloze templates", () => {
			const t1 = "{{c1::A}} and {{c2::B}}";
			const t2 = "{{c1::X}} or {{c2::Y}}";
			const cards = [cloze(t1, 1), cloze(t1, 2), cloze(t2, 1), cloze(t2, 2)];
			const result = cardsToMarkdown(cards);

			expect(result).toBe(`${t1} #flashcard\n\n${t2} #flashcard`);
		});

		it("includes extra answer in cloze block", () => {
			const template = "{{c1::Tokyo}} is a city";
			const cards = [
				cloze(template, 1, "Located in Japan"),
			];
			const result = cardsToMarkdown(cards);

			expect(result).toBe(`${template} #flashcard\nLocated in Japan`);
		});
	});

	describe("reverse pair deduplication", () => {
		it("outputs single #flashcard-reverse block for original + reversed pair", () => {
			const orig = basic("What is X?", "Definition", "orig");
			const rev = reversed("What is X?", "Definition", "orig", "rev");
			const cards = [orig, rev];
			const result = cardsToMarkdown(cards);

			expect(result).toBe("What is X? #flashcard-reverse\nDefinition");
			// Only ONE block
			expect(result.split("#flashcard").length - 1).toBe(1);
		});

		it("handles reversed card appearing before original", () => {
			const orig = basic("Q", "A", "orig");
			const rev = reversed("Q", "A", "orig", "rev");
			// Reversed first in array
			const cards = [rev, orig];
			const result = cardsToMarkdown(cards);

			// Reversed is skipped, original emits the block
			expect(result).toBe("Q #flashcard-reverse\nA");
		});
	});

	describe("mixed types", () => {
		it("handles basic + cloze group", () => {
			const template = "{{c1::Tokyo}} in {{c2::Japan}}";
			const cards = [
				basic("Simple Q", "Simple A", "b1"),
				cloze(template, 1),
				cloze(template, 2),
			];
			const result = cardsToMarkdown(cards);

			expect(result).toBe(
				`Simple Q #flashcard\nSimple A\n\n${template} #flashcard`
			);
		});

		it("handles basic + reverse pair", () => {
			const orig = basic("Q", "A", "orig");
			const rev = reversed("Q", "A", "orig", "rev");
			const cards = [basic("Other Q", "Other A", "b1"), orig, rev];
			const result = cardsToMarkdown(cards);

			expect(result).toBe(
				"Other Q #flashcard\nOther A\n\nQ #flashcard-reverse\nA"
			);
		});

		it("handles all three types: basic + cloze + reverse", () => {
			const template = "{{c1::A}} and {{c2::B}}";
			const orig = basic("What?", "Answer", "orig");
			const rev = reversed("What?", "Answer", "orig", "rev");
			const cards = [
				basic("Plain Q", "Plain A", "b1"),
				cloze(template, 1),
				cloze(template, 2),
				orig,
				rev,
			];
			const result = cardsToMarkdown(cards);
			const blocks = result.split("\n\n");

			expect(blocks).toHaveLength(3);
			expect(blocks[0]).toBe("Plain Q #flashcard\nPlain A");
			expect(blocks[1]).toBe(`${template} #flashcard`);
			expect(blocks[2]).toBe("What? #flashcard-reverse\nAnswer");
		});
	});

	describe("large scale", () => {
		it("handles 10 basics + 3 cloze groups + 5 reverse pairs", () => {
			const cards: (CardLike & { id: string })[] = [];

			for (let i = 0; i < 10; i++) {
				cards.push(basic(`Q${i}`, `A${i}`, `b${i}`));
			}

			for (let g = 0; g < 3; g++) {
				const t = `{{c1::X${g}}} and {{c2::Y${g}}}`;
				cards.push(cloze(t, 1, "", `cloze-${g}-1`));
				cards.push(cloze(t, 2, "", `cloze-${g}-2`));
			}

			for (let p = 0; p < 5; p++) {
				const o = basic(`RQ${p}`, `RA${p}`, `orig${p}`);
				const r = reversed(`RQ${p}`, `RA${p}`, `orig${p}`, `rev${p}`);
				cards.push(o);
				cards.push(r);
			}

			const result = cardsToMarkdown(cards);
			const blocks = result.split("\n\n");

			// 10 basics + 3 cloze templates + 5 reverse blocks = 18
			expect(blocks).toHaveLength(18);
		});
	});
});

// ── previewCards ─────────────────────────────────────────

describe("previewCards", () => {
	describe("basic cards", () => {
		it("returns single preview for basic card", () => {
			const previews = previewCards("What is X? #flashcard\nDefinition");

			expect(previews).toHaveLength(1);
			expect(previews[0]).toEqual({
				label: "Basic",
				question: "What is X?",
				answer: "Definition",
				cardType: "basic",
			});
		});

		it("handles basic card with empty answer", () => {
			const previews = previewCards("What is X? #flashcard");

			expect(previews).toHaveLength(1);
			expect(previews[0]!.question).toBe("What is X?");
			expect(previews[0]!.answer).toBe("");
		});

		it("handles multiple basic cards", () => {
			const content = "Q1 #flashcard\nA1\n\nQ2 #flashcard\nA2";
			const previews = previewCards(content);

			expect(previews).toHaveLength(2);
			expect(previews[0]!.question).toBe("Q1");
			expect(previews[1]!.question).toBe("Q2");
		});

		it("returns empty for empty input", () => {
			expect(previewCards("")).toEqual([]);
		});

		it("returns empty for input without #flashcard tag", () => {
			expect(previewCards("Just some text")).toEqual([]);
		});
	});

	describe("cloze cards", () => {
		it("expands cloze template into multiple previews", () => {
			const content = "{{c1::Tokyo}} is in {{c2::Japan}} #flashcard";
			const previews = previewCards(content);

			expect(previews).toHaveLength(2);
			expect(previews[0]).toEqual({
				label: "Cloze 1",
				question: "[...] is in Japan",
				answer: "**Tokyo** is in Japan",
				cardType: "cloze",
			});
			expect(previews[1]).toEqual({
				label: "Cloze 2",
				question: "Tokyo is in [...]",
				answer: "Tokyo is in **Japan**",
				cardType: "cloze",
			});
		});

		it("handles cloze with hints", () => {
			const content = "{{c1::Paris::capital}} is in {{c2::France::country}} #flashcard";
			const previews = previewCards(content);

			expect(previews).toHaveLength(2);
			expect(previews[0]!.question).toBe("[capital] is in France");
			expect(previews[1]!.question).toBe("Paris is in [country]");
		});

		it("handles single cloze deletion", () => {
			const content = "The answer is {{c1::42}} #flashcard";
			const previews = previewCards(content);

			expect(previews).toHaveLength(1);
			expect(previews[0]!.label).toBe("Cloze 1");
			expect(previews[0]!.question).toBe("The answer is [...]");
		});

		it("includes extra answer text in cloze preview", () => {
			const content = "{{c1::Tokyo}} is a city #flashcard\nLocated in Japan";
			const previews = previewCards(content);

			expect(previews).toHaveLength(1);
			expect(previews[0]!.answer).toBe("**Tokyo** is a city\n\nLocated in Japan");
		});

		it("handles 3 cloze indices", () => {
			const content = "{{c1::A}} {{c2::B}} {{c3::C}} #flashcard";
			const previews = previewCards(content);

			expect(previews).toHaveLength(3);
			expect(previews[0]!.label).toBe("Cloze 1");
			expect(previews[1]!.label).toBe("Cloze 2");
			expect(previews[2]!.label).toBe("Cloze 3");
		});
	});

	describe("reverse cards", () => {
		it("generates Original and Reversed previews", () => {
			const content = "What is X? #flashcard-reverse\nDefinition of X";
			const previews = previewCards(content);

			expect(previews).toHaveLength(2);
			expect(previews[0]).toEqual({
				label: "Original",
				question: "What is X?",
				answer: "Definition of X",
				cardType: "basic",
			});
			expect(previews[1]).toEqual({
				label: "Reversed",
				question: "Definition of X",
				answer: "What is X?",
				cardType: "reversed",
			});
		});

		it("does not create reversed card when answer is empty", () => {
			const content = "What is X? #flashcard-reverse";
			const previews = previewCards(content);

			// Only original, no reversed (no answer to swap)
			expect(previews).toHaveLength(1);
			expect(previews[0]!.label).toBe("Original");
		});
	});

	describe("mixed content", () => {
		it("handles basic + cloze + reverse together", () => {
			const content = [
				"Simple Q #flashcard",
				"Simple A",
				"",
				"{{c1::Tokyo}} in {{c2::Japan}} #flashcard",
				"",
				"What is DNA? #flashcard-reverse",
				"Deoxyribonucleic acid",
			].join("\n");
			const previews = previewCards(content);

			expect(previews).toHaveLength(5);
			// Basic
			expect(previews[0]!.label).toBe("Basic");
			expect(previews[0]!.question).toBe("Simple Q");
			// Cloze 1 and 2
			expect(previews[1]!.label).toBe("Cloze 1");
			expect(previews[2]!.label).toBe("Cloze 2");
			// Reverse Original and Reversed
			expect(previews[3]!.label).toBe("Original");
			expect(previews[4]!.label).toBe("Reversed");
		});
	});

	describe("code blocks", () => {
		it("handles multi-line question with code block", () => {
			const content = [
				"What does this code do?",
				"```js",
				"const x = [1,2,3].map(n => n * 2);",
				"``` #flashcard",
				"Creates [2, 4, 6]",
			].join("\n");
			const previews = previewCards(content);

			expect(previews).toHaveLength(1);
			expect(previews[0]!.question).toContain("```js");
			expect(previews[0]!.question).toContain("const x =");
			expect(previews[0]!.answer).toBe("Creates [2, 4, 6]");
		});

		it("handles code blocks in answer", () => {
			const content = [
				"How to declare a variable? #flashcard",
				"Use `const`:",
				"```typescript",
				"const name: string = 'hello';",
				"```",
			].join("\n");
			const previews = previewCards(content);

			expect(previews).toHaveLength(1);
			expect(previews[0]!.answer).toContain("```typescript");
		});
	});

	describe("edge cases", () => {
		it("handles unicode content", () => {
			const content = "こんにちは means? #flashcard\nHello in Japanese";
			const previews = previewCards(content);

			expect(previews).toHaveLength(1);
			expect(previews[0]!.question).toBe("こんにちは means?");
		});

		it("handles wiki-links in content", () => {
			const content = "What is [[Obsidian]]? #flashcard\nA note app";
			const previews = previewCards(content);

			expect(previews[0]!.question).toBe("What is [[Obsidian]]?");
		});

		it("skips legacy ID lines", () => {
			const content = "What is X? #flashcard\nID: 12345\nThe answer";
			const previews = previewCards(content);

			expect(previews[0]!.answer).toBe("The answer");
		});
	});
});

// ── extractClozeExtraAnswer ─────────────────────────────

describe("extractClozeExtraAnswer", () => {
	it("returns extra text after rendered answer", () => {
		const template = "{{c1::Tokyo}} is a city";
		const rendered = renderClozeAnswer(template, 1);
		const card = {
			answer: `${rendered}\n\nLocated in Japan`,
			clozeTemplate: template,
			clozeIndex: 1,
		};

		expect(extractClozeExtraAnswer(card)).toBe("Located in Japan");
	});

	it("returns empty string when no extra answer", () => {
		const template = "{{c1::Tokyo}} is a city";
		const rendered = renderClozeAnswer(template, 1);
		const card = {
			answer: rendered,
			clozeTemplate: template,
			clozeIndex: 1,
		};

		expect(extractClozeExtraAnswer(card)).toBe("");
	});

	it("returns full answer for non-cloze card (no template)", () => {
		const card = {
			answer: "Just an answer",
		};

		expect(extractClozeExtraAnswer(card)).toBe("Just an answer");
	});

	it("returns full answer for non-cloze card (no clozeIndex)", () => {
		const card = {
			answer: "Just an answer",
			clozeTemplate: "{{c1::X}}",
		};

		expect(extractClozeExtraAnswer(card)).toBe("Just an answer");
	});

	it("handles multi-line extra answer", () => {
		const template = "{{c1::X}} is Y";
		const rendered = renderClozeAnswer(template, 1);
		const card = {
			answer: `${rendered}\n\nLine 1\nLine 2\nLine 3`,
			clozeTemplate: template,
			clozeIndex: 1,
		};

		expect(extractClozeExtraAnswer(card)).toBe("Line 1\nLine 2\nLine 3");
	});

	it("handles cloze with hints in template", () => {
		const template = "{{c1::Paris::capital}} is in France";
		const rendered = renderClozeAnswer(template, 1);
		const card = {
			answer: `${rendered}\n\nExtra info`,
			clozeTemplate: template,
			clozeIndex: 1,
		};

		expect(extractClozeExtraAnswer(card)).toBe("Extra info");
	});
});

// ── Round-trip Tests ────────────────────────────────────

describe("round-trip: serialize → parse → verify", () => {
	const parser = new FlashcardParserService();

	it("basic card round-trips correctly", () => {
		const original = basic("What is photosynthesis?", "The process by which plants convert light");
		const markdown = cardToMarkdown(original);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]!.question).toBe(original.question);
		expect(parsed[0]!.answer).toBe(original.answer);
	});

	it("basic card with multi-line answer round-trips", () => {
		const original = basic("List phases", "1. Prophase\n2. Metaphase\n3. Anaphase");
		const markdown = cardToMarkdown(original);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]!.answer).toBe(original.answer);
	});

	it("cloze card round-trips: template preserved", () => {
		const template = "{{c1::Tokyo}} is in {{c2::Japan}}";
		const cards = [cloze(template, 1), cloze(template, 2)];
		const markdown = cardsToMarkdown(cards);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(2);
		expect(parsed[0]!.cardType).toBe("cloze");
		expect(parsed[0]!.clozeTemplate).toBe(template);
		expect(parsed[0]!.clozeIndex).toBe(1);
		expect(parsed[1]!.clozeIndex).toBe(2);
	});

	it("cloze card with extra answer round-trips", () => {
		const template = "{{c1::Tokyo}} is a city";
		const card = cloze(template, 1, "Located in Japan");
		const markdown = cardToMarkdown(card);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]!.clozeTemplate).toBe(template);
		// Extra answer is appended to the rendered answer
		expect(parsed[0]!.answer).toContain("Located in Japan");
	});

	it("cloze with hints round-trips", () => {
		const template = "{{c1::Paris::capital}} is in {{c2::France::country}}";
		const cards = [cloze(template, 1), cloze(template, 2)];
		const markdown = cardsToMarkdown(cards);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(2);
		expect(parsed[0]!.clozeTemplate).toBe(template);
		expect(parsed[0]!.question).toBe("[capital] is in France");
		expect(parsed[1]!.question).toBe("Paris is in [country]");
	});

	it("reverse pair round-trips", () => {
		const orig = basic("What is DNA?", "Deoxyribonucleic acid", "orig");
		const rev = reversed("What is DNA?", "Deoxyribonucleic acid", "orig", "rev");
		const markdown = cardsToMarkdown([orig, rev]);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(2);
		// First is original
		expect(parsed[0]!.question).toBe("What is DNA?");
		expect(parsed[0]!.answer).toBe("Deoxyribonucleic acid");
		// Second is reversed
		expect(parsed[1]!.cardType).toBe("reversed");
		expect(parsed[1]!.question).toBe("Deoxyribonucleic acid");
		expect(parsed[1]!.answer).toBe("What is DNA?");
	});

	it("mixed content round-trips", () => {
		const template = "{{c1::A}} and {{c2::B}}";
		const origCard = basic("What?", "Answer", "orig");
		const revCard = reversed("What?", "Answer", "orig", "rev");
		const cards: (CardLike & { id: string })[] = [
			basic("Plain Q", "Plain A", "b1"),
			cloze(template, 1, "", "c1"),
			cloze(template, 2, "", "c2"),
			origCard,
			revCard,
		];
		const markdown = cardsToMarkdown(cards);
		const parsed = parser.extractFlashcards(markdown);

		// 1 basic + 2 cloze + 1 original + 1 reversed = 5
		expect(parsed).toHaveLength(5);

		// Basic
		expect(parsed[0]!.question).toBe("Plain Q");
		expect(parsed[0]!.answer).toBe("Plain A");

		// Cloze group
		expect(parsed[1]!.cardType).toBe("cloze");
		expect(parsed[2]!.cardType).toBe("cloze");
		expect(parsed[1]!.clozeTemplate).toBe(template);

		// Reverse pair
		expect(parsed[3]!.question).toBe("What?");
		expect(parsed[4]!.cardType).toBe("reversed");
	});

	it("large-scale round-trip: 10 basics + 3 cloze groups + 5 reverse pairs", () => {
		const cards: (CardLike & { id: string })[] = [];

		for (let i = 0; i < 10; i++) {
			cards.push(basic(`Question ${i}`, `Answer ${i}`, `b${i}`));
		}

		const templates = [
			"{{c1::Tokyo}} is in {{c2::Japan}}",
			"{{c1::H2O}} is {{c2::water}}",
			"{{c1::A}} {{c2::B}} {{c3::C}}",
		];
		for (const t of templates) {
			const indices = t.match(/c(\d+)/g)?.map(m => parseInt(m.slice(1))) ?? [];
			for (const idx of indices) {
				cards.push(cloze(t, idx, "", `cloze-${t.slice(0, 10)}-${idx}`));
			}
		}

		for (let i = 0; i < 5; i++) {
			const o = basic(`RevQ${i}`, `RevA${i}`, `orig${i}`);
			const r = reversed(`RevQ${i}`, `RevA${i}`, `orig${i}`, `rev${i}`);
			cards.push(o);
			cards.push(r);
		}

		const markdown = cardsToMarkdown(cards);
		const parsed = parser.extractFlashcards(markdown);

		// 10 basics + (2+2+3) cloze cards + (5 orig + 5 reversed) = 27
		expect(parsed).toHaveLength(27);

		const parsedBasics = parsed.filter(c => !c.cardType || c.cardType === "basic");
		const parsedClozes = parsed.filter(c => c.cardType === "cloze");
		const parsedReversed = parsed.filter(c => c.cardType === "reversed");

		// 10 basics + 5 originals from reverse pairs = 15
		expect(parsedBasics).toHaveLength(15);
		expect(parsedClozes).toHaveLength(7); // 2+2+3
		expect(parsedReversed).toHaveLength(5);
	});
});

// ── Preview + Serialize Consistency ─────────────────────

describe("preview and serialize consistency", () => {
	it("preview matches what parser would create from serialized content", () => {
		const template = "{{c1::Tokyo}} is in {{c2::Japan}}";
		const cards = [cloze(template, 1), cloze(template, 2)];
		const markdown = cardsToMarkdown(cards);

		const previews = previewCards(markdown);
		const parser = new FlashcardParserService();
		const parsed = parser.extractFlashcards(markdown);

		expect(previews).toHaveLength(parsed.length);
		for (let i = 0; i < previews.length; i++) {
			expect(previews[i]!.question).toBe(parsed[i]!.question);
			expect(previews[i]!.answer).toBe(parsed[i]!.answer);
		}
	});

	it("preview labels match card types", () => {
		const content = [
			"Basic Q #flashcard",
			"Basic A",
			"",
			"{{c1::X}} and {{c2::Y}} #flashcard",
			"",
			"Reverse Q #flashcard-reverse",
			"Reverse A",
		].join("\n");

		const previews = previewCards(content);
		const labels = previews.map(p => p.label);

		expect(labels).toEqual(["Basic", "Cloze 1", "Cloze 2", "Original", "Reversed"]);
	});
});
