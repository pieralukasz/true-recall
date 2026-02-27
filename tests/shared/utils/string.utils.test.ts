import { describe, expect, it } from "vitest";
import { stripMarkdownSyntax } from "../../../src/shared/utils/string.utils";

describe("stripMarkdownSyntax", () => {
	it("returns empty string for empty input", () => {
		expect(stripMarkdownSyntax("")).toBe("");
	});

	it("passes through plain text unchanged", () => {
		expect(stripMarkdownSyntax("Hello world")).toBe("Hello world");
	});

	// ── Inline formatting ──────────────────────────────────────────────

	it("strips bold (**text**)", () => {
		expect(stripMarkdownSyntax("This is **bold** text")).toBe(
			"This is bold text",
		);
	});

	it("strips bold (__text__)", () => {
		expect(stripMarkdownSyntax("This is __bold__ text")).toBe(
			"This is bold text",
		);
	});

	it("strips italic (*text*)", () => {
		expect(stripMarkdownSyntax("This is *italic* text")).toBe(
			"This is italic text",
		);
	});

	it("strips italic (_text_)", () => {
		expect(stripMarkdownSyntax("This is _italic_ text")).toBe(
			"This is italic text",
		);
	});

	it("strips bold-italic (***text***)", () => {
		expect(stripMarkdownSyntax("This is ***bold-italic*** text")).toBe(
			"This is bold-italic text",
		);
	});

	it("strips strikethrough (~~text~~)", () => {
		expect(stripMarkdownSyntax("This is ~~deleted~~ text")).toBe(
			"This is deleted text",
		);
	});

	it("strips highlight (==text==)", () => {
		expect(stripMarkdownSyntax("This is ==highlighted== text")).toBe(
			"This is highlighted text",
		);
	});

	it("strips inline code (`text`)", () => {
		expect(stripMarkdownSyntax("Use `const x = 1` here")).toBe(
			"Use const x = 1 here",
		);
	});

	// ── Links ──────────────────────────────────────────────────────────

	it("strips wiki links ([[target]])", () => {
		expect(stripMarkdownSyntax("See [[My Note]] for details")).toBe(
			"See My Note for details",
		);
	});

	it("strips aliased wiki links ([[target|alias]])", () => {
		expect(stripMarkdownSyntax("See [[My Note|the note]] for details")).toBe(
			"See the note for details",
		);
	});

	it("strips markdown links ([text](url))", () => {
		expect(
			stripMarkdownSyntax("Visit [Google](https://google.com) now"),
		).toBe("Visit Google now");
	});

	// ── Images ─────────────────────────────────────────────────────────

	it("strips wiki images (![[image.png]])", () => {
		expect(stripMarkdownSyntax("Before ![[photo.jpg]] after")).toBe(
			"Before after",
		);
	});

	it("strips markdown images (![alt](url))", () => {
		expect(stripMarkdownSyntax("Before ![alt text](img.png) after")).toBe(
			"Before after",
		);
	});

	// ── Code fences ────────────────────────────────────────────────────

	it("strips code fences", () => {
		expect(
			stripMarkdownSyntax("Before\n```js\nconst x = 1;\n```\nAfter"),
		).toBe("Before After");
	});

	// ── Headings ───────────────────────────────────────────────────────

	it("strips headings (# to ######)", () => {
		expect(stripMarkdownSyntax("# Title")).toBe("Title");
		expect(stripMarkdownSyntax("## Subtitle")).toBe("Subtitle");
		expect(stripMarkdownSyntax("###### Deep")).toBe("Deep");
	});

	// ── Block elements ─────────────────────────────────────────────────

	it("strips blockquotes", () => {
		expect(stripMarkdownSyntax("> This is a quote")).toBe(
			"This is a quote",
		);
	});

	it("strips unordered list markers", () => {
		expect(stripMarkdownSyntax("- Item one\n- Item two")).toBe(
			"Item one Item two",
		);
	});

	it("strips ordered list markers", () => {
		expect(stripMarkdownSyntax("1. First\n2. Second")).toBe(
			"First Second",
		);
	});

	it("strips horizontal rules", () => {
		expect(stripMarkdownSyntax("Above\n---\nBelow")).toBe("Above Below");
	});

	// ── HTML ───────────────────────────────────────────────────────────

	it("strips HTML tags", () => {
		expect(stripMarkdownSyntax("<b>bold</b> and <em>italic</em>")).toBe(
			"bold and italic",
		);
	});

	// ── Cloze deletions ────────────────────────────────────────────────

	it("strips cloze deletions ({{c1::text}})", () => {
		expect(
			stripMarkdownSyntax("The capital of France is {{c1::Paris}}"),
		).toBe("The capital of France is Paris");
	});

	it("strips cloze deletions with hint ({{c1::text::hint}})", () => {
		expect(
			stripMarkdownSyntax(
				"The capital of France is {{c1::Paris::European capital}}",
			),
		).toBe("The capital of France is Paris");
	});

	// ── LaTeX ──────────────────────────────────────────────────────────

	it("strips inline LaTeX ($...$)", () => {
		expect(stripMarkdownSyntax("The formula $E=mc^2$ is famous")).toBe(
			"The formula E=mc^2 is famous",
		);
	});

	it("strips display LaTeX ($$...$$)", () => {
		expect(stripMarkdownSyntax("See $$\\int_0^1 x dx$$ here")).toBe(
			"See \\int_0^1 x dx here",
		);
	});

	// ── Combined patterns ──────────────────────────────────────────────

	it("handles multiple markdown patterns in one string", () => {
		const input =
			"# **Bold** heading with [[wiki link]] and `code`\n> A *quoted* line";
		const result = stripMarkdownSyntax(input);
		expect(result).toBe(
			"Bold heading with wiki link and code A quoted line",
		);
	});

	it("collapses excessive whitespace from stripped content", () => {
		expect(stripMarkdownSyntax("Hello  \n\n  world")).toBe("Hello world");
	});
});
