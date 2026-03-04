import { describe, it, expect } from "vitest";
import {
	cardToMarkdown,
	cardsToMarkdown,
	extractClozeExtraAnswer,
	type CardLike,
} from "../../../src/features/study/services/flashcard/flashcard-format.util";
import { renderClozeAnswer } from "../../../src/features/study/services/flashcard/cloze-parser.service";
import { FlashcardParserService } from "../../../src/features/study/services/flashcard/flashcard-parser.service";

// ── Helpers ──────────────────────────────────────────────

function basic(q: string, a: string, id = "b1"): CardLike & { id: string } {
	return { id, question: q, answer: a };
}

function cloze(
	template: string,
	index: number,
	extra = "",
	id = `c${index}`,
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
	id = "rev",
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
		it("formats basic card with :: separator", () => {
			expect(cardToMarkdown(basic("What is X?", "Definition"))).toBe(
				"What is X? :: Definition",
			);
		});

		it("formats basic card with empty answer (no separator)", () => {
			expect(cardToMarkdown(basic("What is X?", ""))).toBe("What is X?");
		});

		it("treats card with no cardType as basic", () => {
			const card = { question: "Q", answer: "A" };
			expect(cardToMarkdown(card)).toBe("Q :: A");
		});

		it("treats card with cardType 'basic' as basic", () => {
			const card = {
				question: "Q",
				answer: "A",
				cardType: "basic" as const,
			};
			expect(cardToMarkdown(card)).toBe("Q :: A");
		});

		it("preserves markdown formatting in question", () => {
			const card = basic(
				"What does `Array.map()` do?",
				"Transforms elements",
			);
			expect(cardToMarkdown(card)).toBe(
				"What does `Array.map()` do? :: Transforms elements",
			);
		});

		it("serializes multi-line answer (won't round-trip in single-line format)", () => {
			const card = basic(
				"List phases",
				"1. Prophase\n2. Metaphase\n3. Anaphase",
			);
			expect(cardToMarkdown(card)).toBe(
				"List phases :: 1. Prophase\n2. Metaphase\n3. Anaphase",
			);
		});

		it("preserves code blocks in answer", () => {
			const card = basic("What is this?", "```js\nconst x = 1;\n```");
			expect(cardToMarkdown(card)).toBe(
				"What is this? :: ```js\nconst x = 1;\n```",
			);
		});

		it("preserves wiki-links", () => {
			const card = basic("What is [[Obsidian]]?", "A note-taking app");
			expect(cardToMarkdown(card)).toBe(
				"What is [[Obsidian]]? :: A note-taking app",
			);
		});
	});

	describe("cloze cards", () => {
		it("outputs clozeTemplate alone when no extra answer", () => {
			const card = cloze("{{c1::Tokyo}} is in {{c2::Japan}}", 1);
			expect(cardToMarkdown(card)).toBe(
				"{{c1::Tokyo}} is in {{c2::Japan}}",
			);
		});

		it("includes extra answer with :: separator", () => {
			const card = cloze(
				"{{c1::Tokyo}} is a city",
				1,
				"Located on Honshu island",
			);
			expect(cardToMarkdown(card)).toBe(
				"{{c1::Tokyo}} is a city :: Located on Honshu island",
			);
		});

		it("handles cloze with no extra answer", () => {
			const card = cloze("{{c1::Paris}} is beautiful", 1);
			expect(cardToMarkdown(card)).toBe("{{c1::Paris}} is beautiful");
		});

		it("handles cloze with hints in template", () => {
			const card = cloze(
				"{{c1::Paris::capital}} is in {{c2::France::country}}",
				1,
			);
			expect(cardToMarkdown(card)).toBe(
				"{{c1::Paris::capital}} is in {{c2::France::country}}",
			);
		});

		it("cloze card without clozeTemplate falls back to basic format", () => {
			const card: CardLike = {
				question: "rendered Q",
				answer: "rendered A",
				cardType: "cloze",
			};
			expect(cardToMarkdown(card)).toBe("rendered Q :: rendered A");
		});

		it("preserves template with 3+ cloze indices", () => {
			const template = "{{c1::A}} then {{c2::B}} then {{c3::C}}";
			const card = cloze(template, 2);
			expect(cardToMarkdown(card)).toBe(template);
		});
	});

	describe("reversed cards", () => {
		it("outputs original Q/A pair with :: separator", () => {
			// Reversed card stores: question=origA, answer=origQ
			const card = reversed("Capital of France?", "Paris");
			// card.answer = origQ = "Capital of France?", card.question = origA = "Paris"
			expect(cardToMarkdown(card)).toBe("Capital of France? :: Paris");
		});

		it("handles reversed card with empty original answer", () => {
			const card = reversed("Question?", "");
			expect(cardToMarkdown(card)).toBe("Question?");
		});

		it("preserves markdown in reversed content", () => {
			const card = reversed(
				"What does `map` do?",
				"It **transforms** elements",
			);
			expect(cardToMarkdown(card)).toBe(
				"What does `map` do? :: It **transforms** elements",
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
		expect(cardsToMarkdown(cards)).toBe("Q :: A");
	});

	it("separates multiple basic cards with newline", () => {
		const cards = [basic("Q1", "A1", "b1"), basic("Q2", "A2", "b2")];
		expect(cardsToMarkdown(cards)).toBe("Q1 :: A1\nQ2 :: A2");
	});

	describe("cloze deduplication", () => {
		it("outputs single line for 2 cloze siblings", () => {
			const template = "{{c1::Tokyo}} is in {{c2::Japan}}";
			const cards = [cloze(template, 1), cloze(template, 2)];
			const result = cardsToMarkdown(cards);

			expect(result).toBe(template);
		});

		it("outputs single line for 3 cloze siblings", () => {
			const template = "{{c1::A}} {{c2::B}} {{c3::C}}";
			const cards = [
				cloze(template, 1),
				cloze(template, 2),
				cloze(template, 3),
			];
			const result = cardsToMarkdown(cards);

			expect(result).toBe(template);
		});

		it("outputs separate lines for different cloze templates", () => {
			const t1 = "{{c1::A}} and {{c2::B}}";
			const t2 = "{{c1::X}} or {{c2::Y}}";
			const cards = [
				cloze(t1, 1),
				cloze(t1, 2),
				cloze(t2, 1),
				cloze(t2, 2),
			];
			const result = cardsToMarkdown(cards);

			expect(result).toBe(`${t1}\n${t2}`);
		});

		it("includes extra answer in cloze line", () => {
			const template = "{{c1::Tokyo}} is a city";
			const cards = [cloze(template, 1, "Located in Japan")];
			const result = cardsToMarkdown(cards);

			expect(result).toBe(`${template} :: Located in Japan`);
		});
	});

	describe("reverse pair deduplication", () => {
		it("outputs single line for original + reversed pair", () => {
			const orig = basic("What is X?", "Definition", "orig");
			const rev = reversed("What is X?", "Definition", "orig", "rev");
			const cards = [orig, rev];
			const result = cardsToMarkdown(cards);

			expect(result).toBe("What is X? :: Definition");
		});

		it("handles reversed card appearing before original", () => {
			const orig = basic("Q", "A", "orig");
			const rev = reversed("Q", "A", "orig", "rev");
			// Reversed first in array → skipped, original emits
			const cards = [rev, orig];
			const result = cardsToMarkdown(cards);

			expect(result).toBe("Q :: A");
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

			expect(result).toBe(`Simple Q :: Simple A\n${template}`);
		});

		it("handles basic + reverse pair", () => {
			const orig = basic("Q", "A", "orig");
			const rev = reversed("Q", "A", "orig", "rev");
			const cards = [basic("Other Q", "Other A", "b1"), orig, rev];
			const result = cardsToMarkdown(cards);

			expect(result).toBe("Other Q :: Other A\nQ :: A");
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
			const lines = result.split("\n");

			expect(lines).toHaveLength(3);
			expect(lines[0]).toBe("Plain Q :: Plain A");
			expect(lines[1]).toBe(template);
			expect(lines[2]).toBe("What? :: Answer");
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
			const lines = result.split("\n");

			// 10 basics + 3 cloze templates + 5 reverse blocks = 18
			expect(lines).toHaveLength(18);
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
		const original = basic(
			"What is photosynthesis?",
			"The process by which plants convert light",
		);
		const markdown = cardToMarkdown(original);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]!.question).toBe(original.question);
		expect(parsed[0]!.answer).toBe(original.answer);
	});

	it("cloze card with extra round-trips: template preserved", () => {
		const template = "{{c1::Tokyo}} is in {{c2::Japan}}";
		const cards = [
			cloze(template, 1, "Geography"),
			cloze(template, 2, "Geography"),
		];
		const markdown = cardsToMarkdown(cards);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(2);
		expect(parsed[0]!.cardType).toBe("cloze");
		expect(parsed[0]!.clozeTemplate).toBe(template);
		expect(parsed[0]!.clozeIndex).toBe(1);
		expect(parsed[1]!.clozeIndex).toBe(2);
	});

	it("cloze card WITHOUT extra round-trips via standalone cloze fallback", () => {
		const template = "{{c1::Tokyo}} is in {{c2::Japan}}";
		const card = cloze(template, 1);
		const markdown = cardToMarkdown(card);

		// Should output standalone cloze (no :: separator)
		expect(markdown).toBe(template);

		// Parser must still parse it via standalone cloze fallback
		const parsed = parser.extractFlashcards(markdown);
		expect(parsed).toHaveLength(2);
		expect(parsed[0]!.cardType).toBe("cloze");
		expect(parsed[0]!.clozeTemplate).toBe(template);
		expect(parsed[0]!.clozeIndex).toBe(1);
		expect(parsed[1]!.clozeIndex).toBe(2);
	});

	it("single cloze without extra round-trips", () => {
		const template = "{{c1::Paris}} is beautiful";
		const card = cloze(template, 1);
		const markdown = cardToMarkdown(card);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]!.cardType).toBe("cloze");
		expect(parsed[0]!.clozeTemplate).toBe(template);
	});

	it("cloze card with extra answer round-trips", () => {
		const template = "{{c1::Tokyo}} is a city";
		const card = cloze(template, 1, "Located in Japan");
		const markdown = cardToMarkdown(card);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]!.clozeTemplate).toBe(template);
		expect(parsed[0]!.answer).toContain("Located in Japan");
	});

	it("cloze with hints round-trips", () => {
		const template =
			"{{c1::Paris::capital}} is in {{c2::France::country}}";
		const cards = [
			cloze(template, 1, "Europe"),
			cloze(template, 2, "Europe"),
		];
		const markdown = cardsToMarkdown(cards);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(2);
		expect(parsed[0]!.clozeTemplate).toBe(template);
		expect(parsed[0]!.question).toBe("[capital] is in France");
		expect(parsed[1]!.question).toBe("Paris is in [country]");
	});

	it("multiple basic cards round-trip", () => {
		const cards = [
			basic("Q1", "A1", "b1"),
			basic("Q2", "A2", "b2"),
			basic("Q3", "A3", "b3"),
		];
		const markdown = cardsToMarkdown(cards);
		const parsed = parser.extractFlashcards(markdown);

		expect(parsed).toHaveLength(3);
		expect(parsed[0]!.question).toBe("Q1");
		expect(parsed[1]!.question).toBe("Q2");
		expect(parsed[2]!.question).toBe("Q3");
	});
});
