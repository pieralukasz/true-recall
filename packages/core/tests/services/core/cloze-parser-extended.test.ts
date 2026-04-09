/**
 * Cloze Parser — Extended Edge Cases
 *
 * Goes beyond the basic cloze-parser.service.test.ts to cover Anki edge cases:
 * nested clozes, special characters in hints, boundary positions,
 * c0 handling, non-sequential indices, and empty content.
 */
import { describe, expect, it } from "vitest";

import {
	extractClozeIndices,
	hasClozeContent,
	parseClozeTemplate,
	renderClozeAnswer,
	renderClozeQuestion,
} from "../../../src/flashcard/parsing/cloze-parser.service";

describe("cloze parser — extended edge cases", () => {
	// ── Nested clozes ──────────────────────────────────────────

	describe("nested clozes", () => {
		it("nested structure: regex interprets as single cloze with hint", () => {
			// {{c1::outer {{c2::inner}}}} — current regex parses this as:
			// content="outer {{c2", hint="inner" — the inner {{ is just content
			// This is a known limitation matching Anki's simpler regex behavior
			const indices = extractClozeIndices("{{c1::outer {{c2::inner}}}}");
			expect(indices).toContain(1);
			// c2 is consumed as part of c1's content/hint, not a separate cloze
			expect(indices).not.toContain(2);
		});

		it("hasClozeContent returns true for nested structure", () => {
			expect(hasClozeContent("{{c1::outer {{c2::inner}}}}")).toBe(true);
		});
	});

	// ── Special characters in hints ────────────────────────────

	describe("hints with special characters", () => {
		it("handles hint with double quotes", () => {
			const result = renderClozeQuestion(
				'{{c1::answer::hint with "quotes"}}',
				1,
			);
			expect(result).toBe('[hint with "quotes"]');
		});

		it("handles hint with single quotes", () => {
			const result = renderClozeQuestion("{{c1::answer::it's a hint}}", 1);
			expect(result).toBe("[it's a hint]");
		});

		it("handles hint with parentheses", () => {
			const result = renderClozeQuestion("{{c1::answer::hint (optional)}}", 1);
			expect(result).toBe("[hint (optional)]");
		});

		it("handles hint with unicode/emoji", () => {
			const result = renderClozeQuestion("{{c1::東京::capital 🏙️}}", 1);
			expect(result).toBe("[capital 🏙️]");
		});
	});

	// ── Cloze inside markdown formatting ───────────────────────

	describe("cloze inside markdown formatting", () => {
		it("cloze inside bold markers", () => {
			const q = renderClozeQuestion("**{{c1::text}}** is bold", 1);
			expect(q).toBe("**[...]** is bold");
		});

		it("cloze inside italic markers", () => {
			const q = renderClozeQuestion("_{{c1::text}}_ is italic", 1);
			expect(q).toBe("_[...]_ is italic");
		});

		it("cloze inside backtick code", () => {
			const q = renderClozeQuestion("Use `{{c1::git commit}}`", 1);
			expect(q).toBe("Use `[...]`");
		});

		it("cloze answer preserves surrounding markdown", () => {
			const a = renderClozeAnswer("**{{c1::text}}** is bold", 1);
			expect(a).toBe("****text**** is bold");
		});
	});

	// ── Cloze with MathJax ─────────────────────────────────────

	describe("cloze inside MathJax", () => {
		it("cloze inside inline MathJax", () => {
			const q = renderClozeQuestion("\\(2^{{c1::2}}\\)", 1);
			expect(q).toBe("\\(2^[...]\\)");
		});

		it("cloze inside display MathJax", () => {
			const q = renderClozeQuestion("\\[E = {{c1::mc^2}}\\]", 1);
			expect(q).toBe("\\[E = [...]\\]");
		});
	});

	// ── Position edge cases ────────────────────────────────────

	describe("cloze position edge cases", () => {
		it("cloze at very start of text", () => {
			const q = renderClozeQuestion("{{c1::First}} word", 1);
			expect(q).toBe("[...] word");
		});

		it("cloze at very end of text", () => {
			const q = renderClozeQuestion("Last {{c1::word}}", 1);
			expect(q).toBe("Last [...]");
		});

		it("cloze spanning entire text", () => {
			const q = renderClozeQuestion("{{c1::entire text is cloze}}", 1);
			expect(q).toBe("[...]");
		});

		it("cloze spanning entire text — answer side", () => {
			const a = renderClozeAnswer("{{c1::entire text is cloze}}", 1);
			expect(a).toBe("**entire text is cloze**");
		});

		it("multiple clozes adjacent (no space between)", () => {
			const q = renderClozeQuestion("{{c1::Hello}}{{c2::World}}", 1);
			expect(q).toBe("[...]World");
		});
	});

	// ── Index edge cases ───────────────────────────────────────

	describe("cloze index edge cases", () => {
		it("c0 index — detected by regex (Anki considers invalid)", () => {
			// Current regex matches \\d+ which includes 0
			// Documenting actual behavior
			const indices = extractClozeIndices("{{c0::text}} hello");
			expect(indices).toContain(0);
		});

		it("very high index c99 — valid", () => {
			const indices = extractClozeIndices("{{c99::text}}");
			expect(indices).toEqual([99]);
		});

		it("non-sequential indices: c1, c5, c3 — sorted", () => {
			const indices = extractClozeIndices("{{c1::a}} {{c5::b}} {{c3::c}}");
			expect(indices).toEqual([1, 3, 5]);
		});

		it("non-sequential indices produce correct number of cards", () => {
			const cards = parseClozeTemplate("{{c1::a}} {{c5::b}} {{c3::c}}");
			expect(cards).toHaveLength(3);
			expect(cards[0]!.clozeIndex).toBe(1);
			expect(cards[1]!.clozeIndex).toBe(3);
			expect(cards[2]!.clozeIndex).toBe(5);
		});

		it("duplicate index c1 used twice — 1 card, both blanked", () => {
			const cards = parseClozeTemplate("{{c1::a}} middle {{c1::b}}");
			expect(cards).toHaveLength(1);
			expect(cards[0]!.question).toBe("[...] middle [...]");
			expect(cards[0]!.answer).toBe("**a** middle **b**");
		});
	});

	// ── Empty and whitespace cloze content ─────────────────────

	describe("empty and whitespace cloze content", () => {
		it("empty cloze content {{c1::}} — valid, renders empty blank", () => {
			expect(hasClozeContent("{{c1::}}")).toBe(true);
			const q = renderClozeQuestion("{{c1::}} is empty", 1);
			expect(q).toBe("[...] is empty");
		});

		it("cloze with only whitespace {{c1:: }} — renders blank", () => {
			const q = renderClozeQuestion("{{c1:: }} here", 1);
			expect(q).toBe("[...] here");
		});

		it("empty cloze — answer side shows bold empty", () => {
			const a = renderClozeAnswer("{{c1::}} test", 1);
			expect(a).toBe("**** test");
		});

		it("parseClozeTemplate with empty content — still creates card", () => {
			const cards = parseClozeTemplate("{{c1::}}");
			expect(cards).toHaveLength(1);
			expect(cards[0]!.clozeIndex).toBe(1);
		});
	});

	// ── No cloze content ───────────────────────────────────────

	describe("no cloze markers", () => {
		it("plain text — extractClozeIndices returns empty", () => {
			expect(extractClozeIndices("just plain text")).toEqual([]);
		});

		it("plain text — parseClozeTemplate returns empty", () => {
			expect(parseClozeTemplate("just plain text")).toEqual([]);
		});

		it("text with curly braces but no cloze syntax", () => {
			expect(extractClozeIndices("{{not cloze}}")).toEqual([]);
			expect(hasClozeContent("{{not cloze}}")).toBe(false);
		});

		it("malformed cloze syntax — single braces", () => {
			expect(hasClozeContent("{c1::text}")).toBe(false);
		});
	});

	// ── Multiline cloze content ────────────────────────────────

	describe("multiline and long content", () => {
		it("cloze with very long content", () => {
			const longText = "a".repeat(500);
			const q = renderClozeQuestion(`{{c1::${longText}}}`, 1);
			expect(q).toBe("[...]");
		});

		it("multiple clozes spread across lines", () => {
			const template = "Line 1: {{c1::first}}\nLine 2: {{c2::second}}";
			const cards = parseClozeTemplate(template);
			expect(cards).toHaveLength(2);
			expect(cards[0]!.question).toBe("Line 1: [...]\nLine 2: second");
			expect(cards[1]!.question).toBe("Line 1: first\nLine 2: [...]");
		});
	});

	// ── hasClozeContent consecutive calls ──────────────────────

	describe("hasClozeContent regex state", () => {
		it("returns correct result on consecutive calls (lastIndex reset)", () => {
			// Regression: /g flag regex retains lastIndex between .test() calls
			expect(hasClozeContent("{{c1::a}}")).toBe(true);
			expect(hasClozeContent("{{c1::a}}")).toBe(true);
			expect(hasClozeContent("no cloze")).toBe(false);
			expect(hasClozeContent("{{c2::b}}")).toBe(true);
		});
	});
});
