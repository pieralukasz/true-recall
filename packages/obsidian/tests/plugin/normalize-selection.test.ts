import { describe, expect, it } from "vitest";

import { normalizeSelectionForFlashcard } from "@true-recall/obsidian/plugin/normalize-selection";

describe("normalizeSelectionForFlashcard", () => {
	describe("wikilink-wrapped URLs", () => {
		it.each([
			[
				"[[https://refactoring.guru/images/x.png]]",
				"![](https://refactoring.guru/images/x.png)",
			],
			["[[https://example.com]]", "[https://example.com](https://example.com)"],
			["alfa [[https://x.png]] omega", "alfa ![](https://x.png) omega"],
		])("unwraps %s", (input, expected) => {
			expect(normalizeSelectionForFlashcard(input)).toBe(expected);
		});
	});

	describe("bare URLs", () => {
		it.each([
			["https://refactoring.guru/x.png", "![](https://refactoring.guru/x.png)"],
			["https://example.com", "[https://example.com](https://example.com)"],
			[
				"Check https://example.com today",
				"Check [https://example.com](https://example.com) today",
			],
			[
				"See https://x.com/path?q=1.",
				"See [https://x.com/path?q=1](https://x.com/path?q=1).",
			],
		])("converts %s", (input, expected) => {
			expect(normalizeSelectionForFlashcard(input)).toBe(expected);
		});

		it.each([
			["png", "![](https://cdn.example.com/a.png)"],
			["jpg", "![](https://cdn.example.com/a.jpg)"],
			["jpeg", "![](https://cdn.example.com/a.jpeg)"],
			["gif", "![](https://cdn.example.com/a.gif)"],
			["webp", "![](https://cdn.example.com/a.webp)"],
			["svg", "![](https://cdn.example.com/a.svg)"],
		])("treats .%s as image", (ext, expected) => {
			const input = `https://cdn.example.com/a.${ext}`;
			expect(normalizeSelectionForFlashcard(input)).toBe(expected);
		});

		it("treats image URL with query string as image", () => {
			expect(normalizeSelectionForFlashcard("https://x.com/a.png?v=2")).toBe(
				"![](https://x.com/a.png?v=2)",
			);
		});
	});

	describe("local file wikilinks", () => {
		it("converts [[image.png]] to embed", () => {
			expect(normalizeSelectionForFlashcard("[[image.png]]")).toBe(
				"![[image.png]]",
			);
		});

		it("preserves alias on image embed conversion", () => {
			expect(
				normalizeSelectionForFlashcard("[[folder/image.png|caption]]"),
			).toBe("![[folder/image.png|caption]]");
		});

		it("leaves non-image wikilinks alone", () => {
			expect(normalizeSelectionForFlashcard("[[some note]]")).toBe(
				"[[some note]]",
			);
		});

		it("does not double-embed already-embedded images", () => {
			expect(normalizeSelectionForFlashcard("![[image.png]]")).toBe(
				"![[image.png]]",
			);
		});
	});

	describe("already-formatted markdown", () => {
		it("does not re-wrap markdown image", () => {
			const input = "![](https://example.com/x.png)";
			expect(normalizeSelectionForFlashcard(input)).toBe(input);
		});

		it("does not re-wrap markdown link", () => {
			const input = "[label](https://example.com)";
			expect(normalizeSelectionForFlashcard(input)).toBe(input);
		});

		it("does not re-wrap link with URL as label", () => {
			const input = "[https://example.com](https://example.com)";
			expect(normalizeSelectionForFlashcard(input)).toBe(input);
		});
	});

	describe("non-URL text", () => {
		it("leaves plain text untouched", () => {
			const input = "What is the capital of France?\n\nParis";
			expect(normalizeSelectionForFlashcard(input)).toBe(input);
		});

		it("leaves empty string untouched", () => {
			expect(normalizeSelectionForFlashcard("")).toBe("");
		});
	});
});
