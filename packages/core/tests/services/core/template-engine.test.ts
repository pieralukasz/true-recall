/**
 * Template Engine Tests — Anki-compatible template rendering
 *
 * Pure function tests, no database needed.
 * Inspired by Anki's rslib/src/template.rs + cloze.rs test suites.
 */
import { describe, expect, it } from "vitest";
import {
	deriveCardType,
	fieldIsEmpty,
	renderTemplate,
} from "../../../src/services/cards/template-engine";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
	BUILTIN_NOTE_REVIEW_ID,
} from "../../../src/types/note.types";

// ── renderTemplate: field substitution ──────────────────────────

describe("renderTemplate", () => {
	describe("field substitution", () => {
		it("replaces {{FieldName}} with field value", () => {
			const result = renderTemplate("{{Front}}", {
				fields: { Front: "What is ATP?" },
			});
			expect(result).toBe("What is ATP?");
		});

		it("replaces multiple different fields in same template", () => {
			const result = renderTemplate("Q: {{Front}} A: {{Back}}", {
				fields: { Front: "What?", Back: "That." },
			});
			expect(result).toBe("Q: What? A: That.");
		});

		it("replaces same field appearing multiple times", () => {
			const result = renderTemplate("{{Word}} means {{Word}}", {
				fields: { Word: "hello" },
			});
			expect(result).toBe("hello means hello");
		});

		it("handles field with empty string value (replaces with empty)", () => {
			const result = renderTemplate("Value: {{Back}}", {
				fields: { Back: "" },
			});
			expect(result).toBe("Value: ");
		});

		it("handles field with markdown content (preserves markdown)", () => {
			const result = renderTemplate("{{Front}}", {
				fields: { Front: "**bold** and _italic_ and `code`" },
			});
			expect(result).toBe("**bold** and _italic_ and `code`");
		});

		it("preserves $$ block math delimiters in field values", () => {
			const result = renderTemplate("{{Front}}", {
				fields: { Front: "$$\ny = x^2\n$$" },
			});
			expect(result).toBe("$$\ny = x^2\n$$");
		});

		it("preserves $ inline math in field values", () => {
			const result = renderTemplate("{{Front}}", {
				fields: { Front: "The formula $E = mc^2$ is famous" },
			});
			expect(result).toBe("The formula $E = mc^2$ is famous");
		});

		it("handles field with HTML content (preserves HTML)", () => {
			const result = renderTemplate("{{Front}}", {
				fields: { Front: "<b>bold</b><br><i>italic</i>" },
			});
			expect(result).toBe("<b>bold</b><br><i>italic</i>");
		});

		it("handles field with newlines (preserves newlines)", () => {
			const result = renderTemplate("{{Front}}", {
				fields: { Front: "line1\nline2\nline3" },
			});
			expect(result).toBe("line1\nline2\nline3");
		});

		it("handles field with unicode/emoji content", () => {
			const result = renderTemplate("{{Word}}", {
				fields: { Word: "食べる 🍣" },
			});
			expect(result).toBe("食べる 🍣");
		});

		it("leaves {{UnknownField}} unreplaced when field not in context", () => {
			const result = renderTemplate("{{Unknown}}", {
				fields: { Front: "value" },
			});
			expect(result).toBe("{{Unknown}}");
		});

		it("is case-sensitive: {{front}} ≠ {{Front}}", () => {
			const result = renderTemplate("{{front}}", {
				fields: { Front: "value" },
			});
			// {{front}} is not the same field as Front, so it stays unreplaced
			expect(result).toBe("{{front}}");
		});

		it("handles whitespace in braces: {{ Front }} trims and matches", () => {
			const result = renderTemplate("{{ Front }}", {
				fields: { Front: "trimmed" },
			});
			expect(result).toBe("trimmed");
		});
	});

	// ── {{FrontSide}} substitution ──────────────────────────────

	describe("{{FrontSide}} stripping", () => {
		it("strips {{FrontSide}} from template (Q/A shown separately)", () => {
			const result = renderTemplate("{{FrontSide}}<hr>{{Back}}", {
				fields: { Back: "Paris" },
				frontSide: "What is the capital of France?",
			});
			expect(result).toBe("<hr>Paris");
		});

		it("strips {{FrontSide}} even when frontSide not provided", () => {
			const result = renderTemplate("{{FrontSide}}<hr>{{Back}}", {
				fields: { Back: "answer" },
			});
			expect(result).toBe("<hr>answer");
		});

		it("strips all {{FrontSide}} occurrences", () => {
			const result = renderTemplate("{{FrontSide}} -- {{FrontSide}}", {
				fields: {},
				frontSide: "Q",
			});
			expect(result).toBe(" -- ");
		});

		it("strips {{FrontSide}} in qfmt too", () => {
			const result = renderTemplate("{{FrontSide}}{{Front}}", {
				fields: { Front: "question" },
			});
			expect(result).toBe("question");
		});
	});

	// ── {{edit:Field}} modifier stripping ───────────────────────

	describe("{{edit:Field}} modifier stripping", () => {
		it("renders {{edit:Front}} as plain field substitution", () => {
			const result = renderTemplate("{{edit:Front}}", {
				fields: { Front: "What is ATP?" },
			});
			expect(result).toBe("What is ATP?");
		});

		it("renders {{edit:Back}} in afmt as plain field substitution", () => {
			const result = renderTemplate("{{edit:Back}}", {
				fields: { Back: "Adenosine triphosphate" },
				frontSide: "What is ATP?",
			});
			expect(result).toBe("Adenosine triphosphate");
		});

		it("handles {{FrontSide}} + {{edit:Back}} together (FrontSide stripped)", () => {
			const result = renderTemplate("{{FrontSide}}\n{{edit:Back}}", {
				fields: { Back: "4" },
				frontSide: "",
			});
			expect(result).toBe("\n4");
		});

		it("handles whitespace in edit modifier: {{ edit:Front }}", () => {
			const result = renderTemplate("{{ edit:Front }}", {
				fields: { Front: "question" },
			});
			expect(result).toBe("question");
		});
	});

	// ── Conditionals {{#Field}}...{{/Field}} ────────────────────

	describe("conditionals {{#Field}}...{{/Field}}", () => {
		it("renders content when field is non-empty", () => {
			const result = renderTemplate("{{#Hint}}Hint: {{Hint}}{{/Hint}}", {
				fields: { Hint: "Think about ATP" },
			});
			expect(result).toBe("Hint: Think about ATP");
		});

		it("hides content when field is empty string", () => {
			const result = renderTemplate("{{#Hint}}Hint: {{Hint}}{{/Hint}}", {
				fields: { Hint: "" },
			});
			expect(result).toBe("");
		});

		it("hides content when field is whitespace-only", () => {
			const result = renderTemplate("{{#Hint}}shown{{/Hint}}", {
				fields: { Hint: "   " },
			});
			expect(result).toBe("");
		});

		it("hides content when field is only <br> tags (Anki compat)", () => {
			const result = renderTemplate("{{#Hint}}shown{{/Hint}}", {
				fields: { Hint: "<br>" },
			});
			expect(result).toBe("");
		});

		it("hides content when field is only empty <div> tags", () => {
			const result = renderTemplate("{{#Hint}}shown{{/Hint}}", {
				fields: { Hint: "<div> </div>" },
			});
			expect(result).toBe("");
		});

		it("shows content when field has any visible text", () => {
			const result = renderTemplate("{{#Hint}}shown{{/Hint}}", {
				fields: { Hint: "<div>x</div>" },
			});
			expect(result).toBe("shown");
		});

		it("handles nested conditionals: {{#A}}{{#B}}text{{/B}}{{/A}}", () => {
			const result = renderTemplate("{{#A}}{{#B}}nested{{/B}}{{/A}}", {
				fields: { A: "yes", B: "yes" },
			});
			expect(result).toBe("nested");
		});

		it("handles 3+ levels of nesting", () => {
			const result = renderTemplate(
				"{{#A}}{{#B}}{{#C}}deep{{/C}}{{/B}}{{/A}}",
				{ fields: { A: "1", B: "2", C: "3" } },
			);
			expect(result).toBe("deep");
		});

		it("nested conditional hides when inner field empty", () => {
			const result = renderTemplate("{{#A}}{{#B}}nested{{/B}}{{/A}}", {
				fields: { A: "yes", B: "" },
			});
			expect(result).toBe("");
		});

		it("handles multiple sequential conditionals", () => {
			const result = renderTemplate("{{#A}}aaa{{/A}}{{#B}}bbb{{/B}}", {
				fields: { A: "yes", B: "" },
			});
			expect(result).toBe("aaa");
		});

		it("handles conditional with field substitution inside", () => {
			const result = renderTemplate("{{#Extra}}Extra: {{Extra}}{{/Extra}}", {
				fields: { Extra: "bonus info" },
			});
			expect(result).toBe("Extra: bonus info");
		});
	});

	// ── Inverse conditionals {{^Field}}...{{/Field}} ────────────

	describe("inverse conditionals {{^Field}}...{{/Field}}", () => {
		it("renders content when field IS empty", () => {
			const result = renderTemplate("{{^Hint}}no hint{{/Hint}}", {
				fields: { Hint: "" },
			});
			expect(result).toBe("no hint");
		});

		it("hides content when field is non-empty", () => {
			const result = renderTemplate("{{^Hint}}no hint{{/Hint}}", {
				fields: { Hint: "exists" },
			});
			expect(result).toBe("");
		});

		it("handles nested inverse conditionals", () => {
			const result = renderTemplate("{{^A}}{{^B}}both empty{{/B}}{{/A}}", {
				fields: { A: "", B: "" },
			});
			expect(result).toBe("both empty");
		});

		it("handles mixed: {{#A}}has A{{/A}}{{^A}}no A{{/A}}", () => {
			const withA = renderTemplate("{{#A}}has A{{/A}}{{^A}}no A{{/A}}", {
				fields: { A: "yes" },
			});
			expect(withA).toBe("has A");

			const withoutA = renderTemplate("{{#A}}has A{{/A}}{{^A}}no A{{/A}}", {
				fields: { A: "" },
			});
			expect(withoutA).toBe("no A");
		});
	});

	// ── Cloze rendering {{cloze:Field}} ─────────────────────────

	describe("cloze rendering {{cloze:Field}}", () => {
		it("renders cloze for target index (shows [...] on question side)", () => {
			const result = renderTemplate("{{cloze:Text}}", {
				fields: { Text: "{{c1::Paris}} is the capital of France" },
				clozeIndex: 1,
			});
			expect(result).toBe("[...] is the capital of France");
		});

		it("renders cloze with hint (shows [hint] on question side)", () => {
			const result = renderTemplate("{{cloze:Text}}", {
				fields: { Text: "{{c1::Paris::city}} is the capital" },
				clozeIndex: 1,
			});
			expect(result).toBe("[city] is the capital");
		});

		it("reveals non-target clozes as plain text", () => {
			const result = renderTemplate("{{cloze:Text}}", {
				fields: {
					Text: "{{c1::Paris}} is the capital of {{c2::France}}",
				},
				clozeIndex: 1,
			});
			expect(result).toBe("[...] is the capital of France");
		});

		it("renders bold on answer side for target cloze", () => {
			// On the answer side, cloze rendering shows the answer in bold
			// The answer template typically has {{cloze:Text}} too, but
			// the rendering mode differs (answer vs question)
			// For now we test question-side rendering which is the primary use
			const result = renderTemplate("{{cloze:Text}}", {
				fields: {
					Text: "{{c1::Paris}} is the capital of France",
				},
				clozeIndex: 1,
				frontSide: "[...] is the capital of France",
			});
			// On answer side (frontSide is set), target cloze shows bold
			expect(result).toBe("**Paris** is the capital of France");
		});

		it("handles multiple cloze deletions in one field", () => {
			const result = renderTemplate("{{cloze:Text}}", {
				fields: {
					Text: "{{c1::H2O}} is {{c2::water}} and {{c3::essential}}",
				},
				clozeIndex: 2,
			});
			expect(result).toBe("H2O is [...] and essential");
		});

		it("handles cloze with no matching index (returns text as-is, clozes revealed)", () => {
			const result = renderTemplate("{{cloze:Text}}", {
				fields: { Text: "{{c1::Paris}} and {{c2::London}}" },
				clozeIndex: 5,
			});
			// No c5 exists, all clozes revealed
			expect(result).toBe("Paris and London");
		});

		it("handles nested clozes: {{c1::outer {{c2::inner}}}}", () => {
			const result = renderTemplate("{{cloze:Text}}", {
				fields: { Text: "{{c1::outer {{c2::inner}}}}" },
				clozeIndex: 1,
			});
			// c1 is the target — the whole outer expression is blanked
			expect(result).toBe("[...]");
		});

		it("handles c0 (invalid, should not match as cloze)", () => {
			const result = renderTemplate("{{cloze:Text}}", {
				fields: { Text: "{{c0::text}} hello" },
				clozeIndex: 0,
			});
			// c0 is not a valid cloze index — behavior: leave as-is or strip
			// The important thing is it doesn't crash
			expect(result).toBeDefined();
		});

		it("handles cloze inside markdown/code blocks", () => {
			const result = renderTemplate("{{cloze:Text}}", {
				fields: { Text: "The command is `{{c1::git commit}}`" },
				clozeIndex: 1,
			});
			expect(result).toBe("The command is `[...]`");
		});

		it("handles multiple same-index clozes: {{c1::a}} and {{c1::b}}", () => {
			const result = renderTemplate("{{cloze:Text}}", {
				fields: {
					Text: "{{c1::Paris}} and {{c1::London}} are cities",
				},
				clozeIndex: 1,
			});
			// Both c1 clozes should be blanked
			expect(result).toBe("[...] and [...] are cities");
		});
	});

	// ── Error handling ──────────────────────────────────────────

	describe("error handling", () => {
		it("mismatched conditional tags: {{#A}}{{/B}} — graceful fallback", () => {
			// Should not throw; behavior can be: ignore mismatch or treat as text
			const result = renderTemplate("{{#A}}content{{/B}}", {
				fields: { A: "yes", B: "yes" },
			});
			expect(result).toBeDefined();
		});

		it("unclosed conditional: {{#A}}text — graceful fallback", () => {
			const result = renderTemplate("{{#A}}text without close", {
				fields: { A: "yes" },
			});
			expect(result).toBeDefined();
		});

		it("orphaned close tag: {{/A}} — treated as plain text", () => {
			const result = renderTemplate("before{{/A}}after", {
				fields: { A: "yes" },
			});
			expect(result).toContain("before");
			expect(result).toContain("after");
		});

		it("empty template string — returns empty string", () => {
			const result = renderTemplate("", { fields: {} });
			expect(result).toBe("");
		});

		it("template with no handlebars — returns plain text unchanged", () => {
			const result = renderTemplate("plain text here", {
				fields: { Front: "unused" },
			});
			expect(result).toBe("plain text here");
		});

		it("stray }} without {{ — treated as plain text", () => {
			const result = renderTemplate("text }} more", { fields: {} });
			expect(result).toBe("text }} more");
		});

		it("HTML comments containing handlebars — not processed", () => {
			const result = renderTemplate("before<!--{{Front}}-->after", {
				fields: { Front: "SHOULD NOT APPEAR" },
			});
			// Handlebars inside HTML comments should be left as-is
			expect(result).not.toContain("SHOULD NOT APPEAR");
			expect(result).toContain("before");
			expect(result).toContain("after");
		});
	});

	// ── Edge cases ──────────────────────────────────────────────

	describe("edge cases", () => {
		it("template with only whitespace", () => {
			const result = renderTemplate("   ", { fields: {} });
			expect(result).toBe("   ");
		});

		it("very long field values (10KB+)", () => {
			const longValue = "x".repeat(10_000);
			const result = renderTemplate("{{Front}}", {
				fields: { Front: longValue },
			});
			expect(result).toBe(longValue);
			expect(result).toHaveLength(10_000);
		});

		it("field value containing {{ and }} characters", () => {
			const result = renderTemplate("{{Front}}", {
				fields: { Front: "Use {{variable}} syntax" },
			});
			// The field value should be inserted as-is, not re-processed
			expect(result).toBe("Use {{variable}} syntax");
		});

		it("field value containing template syntax (should NOT be re-processed)", () => {
			const result = renderTemplate("{{Front}}", {
				fields: { Front: "{{#Back}}hidden{{/Back}}" },
			});
			// Template syntax in field values must NOT be re-evaluated
			expect(result).toBe("{{#Back}}hidden{{/Back}}");
		});

		it("empty fields object", () => {
			const result = renderTemplate("{{Front}}", { fields: {} });
			// Unknown field — left unreplaced
			expect(result).toBe("{{Front}}");
		});

		it("template referencing field not in fields (graceful)", () => {
			const result = renderTemplate("Hello {{Missing}} world", {
				fields: { Other: "value" },
			});
			expect(result).toBe("Hello {{Missing}} world");
		});
	});
});

// ── fieldIsEmpty — Anki compatibility ───────────────────────────

describe("fieldIsEmpty", () => {
	it('empty string "" → true', () => {
		expect(fieldIsEmpty("")).toBe(true);
	});

	it('whitespace " " → true', () => {
		expect(fieldIsEmpty(" ")).toBe(true);
	});

	it('"x" → false', () => {
		expect(fieldIsEmpty("x")).toBe(false);
	});

	it('"<br>" → true', () => {
		expect(fieldIsEmpty("<br>")).toBe(true);
	});

	it('"<BR>" → true (case insensitive)', () => {
		expect(fieldIsEmpty("<BR>")).toBe(true);
	});

	it('"<br/>" → true', () => {
		expect(fieldIsEmpty("<br/>")).toBe(true);
	});

	it('"<br />" → true', () => {
		expect(fieldIsEmpty("<br />")).toBe(true);
	});

	it('"<div></div>" → true', () => {
		expect(fieldIsEmpty("<div></div>")).toBe(true);
	});

	it('"<div> </div>" → true', () => {
		expect(fieldIsEmpty("<div> </div>")).toBe(true);
	});

	it('" <div> <br> </div>\\n" → true', () => {
		expect(fieldIsEmpty(" <div> <br> </div>\n")).toBe(true);
	});

	it('" <div>x</div>\\n" → false', () => {
		expect(fieldIsEmpty(" <div>x</div>\n")).toBe(false);
	});

	it('"<p></p>" → true', () => {
		expect(fieldIsEmpty("<p></p>")).toBe(true);
	});

	it('"&nbsp;" → true', () => {
		expect(fieldIsEmpty("&nbsp;")).toBe(true);
	});
});

// ── deriveCardType ──────────────────────────────────────────────

describe("deriveCardType", () => {
	it("noteType.type=0, templateOrd=0 → basic", () => {
		expect(deriveCardType({ id: BUILTIN_BASIC_ID, type: 0 }, 0)).toBe("basic");
	});

	it("noteType.type=0, templateOrd=1 → reversed", () => {
		expect(deriveCardType({ id: BUILTIN_BASIC_REVERSED_ID, type: 0 }, 1)).toBe(
			"reversed",
		);
	});

	it("noteType.type=0, templateOrd=2 → reversed", () => {
		expect(deriveCardType({ id: "custom-3-template", type: 0 }, 2)).toBe(
			"reversed",
		);
	});

	it("noteType.type=1, any templateOrd → cloze", () => {
		expect(deriveCardType({ id: BUILTIN_CLOZE_ID, type: 1 }, 0)).toBe("cloze");
		expect(deriveCardType({ id: BUILTIN_CLOZE_ID, type: 1 }, 5)).toBe("cloze");
	});

	it('noteType.id="builtin-image-occlusion" → image-occlusion', () => {
		expect(deriveCardType({ id: BUILTIN_IMAGE_OCCLUSION_ID, type: 0 }, 0)).toBe(
			"image-occlusion",
		);
		expect(deriveCardType({ id: BUILTIN_IMAGE_OCCLUSION_ID, type: 0 }, 3)).toBe(
			"image-occlusion",
		);
	});

	it('noteType.id="builtin-note-review" → note-review', () => {
		expect(deriveCardType({ id: BUILTIN_NOTE_REVIEW_ID, type: 0 }, 0)).toBe(
			"note-review",
		);
	});
});
