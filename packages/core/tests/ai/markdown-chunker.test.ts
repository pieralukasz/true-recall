import { describe, expect, it } from "vitest";

import {
	chunkMarkdown,
	filterContent,
} from "../../src/ai/parsing/markdown-chunker";

describe("filterContent", () => {
	it("removes YAML frontmatter", () => {
		const input = `---
title: Test
tags: [a, b]
---
Some content here`;
		expect(filterContent(input)).toBe("Some content here");
	});

	it("removes fenced code blocks", () => {
		const input = `Before code

\`\`\`typescript
const x = 1;
console.log(x);
\`\`\`

After code`;
		expect(filterContent(input)).toBe("Before code\n\nAfter code");
	});

	it("removes Obsidian comments", () => {
		expect(filterContent("Before %%secret%% after")).toBe("Before  after");
	});

	it("removes HTML comments", () => {
		expect(filterContent("Before <!-- comment --> after")).toBe(
			"Before  after",
		);
	});

	it("removes image embeds on their own line", () => {
		const input = `Text before
![[image.png]]
![[Pasted image 20240101.png]]
![alt](https://example.com/img.png)
Text after`;
		const result = filterContent(input);
		expect(result).toContain("Text before");
		expect(result).toContain("Text after");
		expect(result).not.toContain("image.png");
		expect(result).not.toContain("example.com");
	});

	it("keeps callout blocks", () => {
		const input = `> [!info] Important
> This is a key concept`;
		expect(filterContent(input)).toContain("[!info]");
	});

	it("keeps wikilinks and highlights", () => {
		const input = "This is a [[wikilink]] and ==highlighted== text";
		expect(filterContent(input)).toBe(input);
	});

	it("collapses multiple blank lines", () => {
		const input = "Line 1\n\n\n\n\nLine 2";
		expect(filterContent(input)).toBe("Line 1\n\nLine 2");
	});

	it("handles empty input", () => {
		expect(filterContent("")).toBe("");
	});
});

describe("chunkMarkdown", () => {
	it("returns single strategy for short content", () => {
		const result = chunkMarkdown("Short note with a few words.");
		expect(result.strategy).toBe("single");
		expect(result.chunks).toHaveLength(1);
		expect(result.chunks[0]!.content).toBe("Short note with a few words.");
	});

	it("returns single strategy for content under 3000 words", () => {
		const words = Array(2500).fill("word").join(" ");
		const result = chunkMarkdown(words);
		expect(result.strategy).toBe("single");
		expect(result.chunks).toHaveLength(1);
	});

	it("returns chunked strategy for content over 3000 words", () => {
		const section1 = `# Section One\n\n${Array(2000).fill("alpha").join(" ")}`;
		const section2 = `# Section Two\n\n${Array(2000).fill("beta").join(" ")}`;
		const content = `${section1}\n\n${section2}`;
		const result = chunkMarkdown(content);
		expect(result.strategy).toBe("chunked");
		expect(result.chunks.length).toBeGreaterThanOrEqual(2);
	});

	it("builds heading breadcrumbs correctly", () => {
		const content = [
			`# Chapter 1`,
			Array(1800).fill("word").join(" "),
			`## Section A`,
			Array(1800).fill("word").join(" "),
			`## Section B`,
			Array(1800).fill("word").join(" "),
		].join("\n");

		const result = chunkMarkdown(content);
		expect(result.strategy).toBe("chunked");

		const breadcrumbs = result.chunks.map((c) => c.headingBreadcrumb);
		expect(breadcrumbs.some((b) => b.includes("Chapter 1"))).toBe(true);
	});

	it("handles nested headings", () => {
		const content = [
			`# Top`,
			Array(1600).fill("word").join(" "),
			`## Mid`,
			Array(1600).fill("word").join(" "),
			`### Deep`,
			Array(1600).fill("word").join(" "),
		].join("\n");

		const result = chunkMarkdown(content);
		expect(result.strategy).toBe("chunked");

		const deepChunk = result.chunks.find((c) =>
			c.headingBreadcrumb.includes("Deep"),
		);
		if (deepChunk) {
			expect(deepChunk.headingBreadcrumb).toContain("Top");
			expect(deepChunk.headingBreadcrumb).toContain("Mid");
			expect(deepChunk.headingBreadcrumb).toContain("Deep");
		}
	});

	it("accumulates small sections into larger chunks", () => {
		const content = [
			`# Intro`,
			"A few words only.",
			`# Main Content`,
			Array(3500).fill("word").join(" "),
		].join("\n");

		const result = chunkMarkdown(content);
		// Intro (few words) + Main Content (3500 words) should be in ≤2 chunks, not 2 separate tiny chunks
		expect(result.chunks.length).toBeLessThanOrEqual(2);
		// First chunk should contain the intro text
		expect(result.chunks[0]!.content).toContain("A few words only.");
	});

	it("splits by paragraphs when no headings exist", () => {
		const paragraphs = Array(20)
			.fill(null)
			.map((_, i) => `Paragraph ${i}: ${Array(200).fill("word").join(" ")}`)
			.join("\n\n");

		const result = chunkMarkdown(paragraphs);
		expect(result.strategy).toBe("chunked");
		expect(result.chunks.length).toBeGreaterThanOrEqual(2);

		// Should use "Part N" breadcrumbs
		expect(result.chunks[0]!.headingBreadcrumb).toMatch(/^Part \d+$/);
	});

	it("strips frontmatter before chunking", () => {
		const frontmatter = `---\ntitle: Big Note\ntags: [test]\n---\n`;
		const body = Array(3500).fill("word").join(" ");
		const content = `${frontmatter}# Section 1\n\n${body}`;

		const result = chunkMarkdown(content);
		for (const chunk of result.chunks) {
			expect(chunk.content).not.toContain("---");
			expect(chunk.content).not.toContain("title: Big Note");
		}
	});

	it("strips code blocks before chunking", () => {
		const codeBlock = "```js\nconst x = 1;\n```";
		const text = Array(2000).fill("word").join(" ");
		const content = `# Part 1\n\n${text}\n\n${codeBlock}\n\n# Part 2\n\n${text}`;

		const result = chunkMarkdown(content);
		for (const chunk of result.chunks) {
			expect(chunk.content).not.toContain("const x = 1");
		}
	});

	it("handles empty content after filtering", () => {
		const content = `---
title: Empty
---

\`\`\`
all code
\`\`\`

![[image.png]]`;

		const result = chunkMarkdown(content);
		expect(result.strategy).toBe("single");
		expect(result.totalWords).toBe(0);
	});

	it("estimates tokens as words * 1.3", () => {
		const words = Array(1000).fill("word").join(" ");
		const result = chunkMarkdown(words);
		expect(result.estimatedTokens).toBe(Math.ceil(1000 * 1.3));
	});

	it("consolidates many small heading sections into few chunks", () => {
		// 50 headings with ~100 words each = 5000 words total
		const sections = Array(50)
			.fill(null)
			.map((_, i) => `## Term ${i}\n\n${Array(100).fill("word").join(" ")}`)
			.join("\n\n");
		const result = chunkMarkdown(sections);
		expect(result.strategy).toBe("chunked");
		// Should produce ~2 chunks (5000/3000), NOT 50
		expect(result.chunks.length).toBeLessThanOrEqual(3);
	});

	it("splits very long single section by paragraphs", () => {
		const paragraphs = Array(30)
			.fill(null)
			.map((_, i) => `Paragraph ${i}: ${Array(200).fill("concept").join(" ")}`)
			.join("\n\n");
		const content = `# Huge Section\n\n${paragraphs}`;

		const result = chunkMarkdown(content);
		expect(result.strategy).toBe("chunked");
		expect(result.chunks.length).toBeGreaterThan(1);
		// All sub-chunks share the heading breadcrumb
		for (const chunk of result.chunks) {
			expect(
				chunk.headingBreadcrumb === "Huge Section" ||
					chunk.headingBreadcrumb === "",
			).toBe(true);
		}
	});
});
