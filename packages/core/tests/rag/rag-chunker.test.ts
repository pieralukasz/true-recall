import { describe, expect, it } from "vitest";
import {
	chunkFlashcard,
	chunkNote,
} from "../../src/rag/ingestion/rag-chunker.service";

describe("chunkNote", () => {
	it("returns single chunk for short content", () => {
		const chunks = chunkNote("Hello world, this is a short note.");
		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.index).toBe(0);
		expect(chunks[0]?.headingBreadcrumb).toBe("");
		expect(chunks[0]?.tokenCount).toBeGreaterThan(0);
	});

	it("returns empty-ish chunk for empty input", () => {
		const chunks = chunkNote("");
		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.tokenCount).toBe(0);
	});

	it("splits by headings and builds breadcrumbs", () => {
		const content = [
			"# Introduction",
			"Some intro text that is long enough to matter. ".repeat(30),
			"## Background",
			"Background text that provides context. ".repeat(30),
			"### Details",
			"Detailed information about the topic. ".repeat(30),
		].join("\n");

		const chunks = chunkNote(content);
		expect(chunks.length).toBeGreaterThan(1);

		const breadcrumbs = chunks.map((c) => c.headingBreadcrumb);
		expect(breadcrumbs.some((b) => b.includes("Introduction"))).toBe(true);
		expect(breadcrumbs.some((b) => b.includes("Background"))).toBe(true);
	});

	it("pops heading stack when encountering same-level heading", () => {
		// Make sections large enough to be separate chunks
		const content = [
			"## Section A",
			"Content A that is quite wordy and long. ".repeat(40),
			"## Section B",
			"Content B that is quite wordy and long. ".repeat(40),
		].join("\n");

		const chunks = chunkNote(content);
		// If merged into one chunk, Section B breadcrumb should not include Section A
		const sectionBChunks = chunks.filter((c) =>
			c.headingBreadcrumb.includes("Section B"),
		);
		if (sectionBChunks.length > 0) {
			expect(
				sectionBChunks.every((c) => !c.headingBreadcrumb.includes("Section A")),
			).toBe(true);
		}
		// At minimum, the content from both sections should be present
		const allContent = chunks.map((c) => c.content).join(" ");
		expect(allContent).toContain("Content A");
		expect(allContent).toContain("Content B");
	});

	it("falls back to paragraph splitting when no headings", () => {
		const content = Array(50)
			.fill("This is a paragraph with some words in it.")
			.join("\n\n");
		const chunks = chunkNote(content);
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks[0]?.headingBreadcrumb).toMatch(/Part \d+/);
	});

	it("sub-chunks very large sections", () => {
		const paragraphs = Array.from({ length: 20 }, () => "Word ".repeat(60));
		const content = ["# Big Section", ...paragraphs].join("\n\n");
		const chunks = chunkNote(content);
		expect(chunks.length).toBeGreaterThan(1);
	});
});

describe("chunkFlashcard", () => {
	it("parses valid JSON with front/back fields", () => {
		const json = JSON.stringify({ front: "What is X?", back: "Y" });
		const chunks = chunkFlashcard(json);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.content).toContain("Q: What is X?");
		expect(chunks[0]?.content).toContain("A: Y");
	});

	it("parses JSON with text field", () => {
		const json = JSON.stringify({ text: "Some text content" });
		const chunks = chunkFlashcard(json);
		expect(chunks[0]?.content).toContain("Text: Some text content");
	});

	it("appends source text and tags when provided", () => {
		const json = JSON.stringify({ front: "Q", back: "A" });
		const chunks = chunkFlashcard(json, "Source context", "tag1,tag2");
		expect(chunks[0]?.content).toContain("Source: Source context");
		expect(chunks[0]?.content).toContain("Tags: tag1,tag2");
	});

	it("falls back to raw JSON on parse failure", () => {
		const invalid = "not valid json {";
		const chunks = chunkFlashcard(invalid);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.content).toBe(invalid);
	});

	it("handles empty fields gracefully", () => {
		const json = JSON.stringify({});
		const chunks = chunkFlashcard(json);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.content).toBe("");
	});
});
