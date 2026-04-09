import { describe, expect, it } from "vitest";

import type { SearchResult } from "../../src/rag/rag-search.service";
import {
	groupSources,
	stripMarkdown,
} from "../../src/rag/retrieval/rag-source-grouper";

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
	return {
		chunkId: 1,
		content: "test content",
		headingBreadcrumb: "",
		sourceType: "note",
		sourceId: "test.md",
		score: 0.5,
		tokenCount: 10,
		...overrides,
	};
}

describe("groupSources", () => {
	it("groups chunks from the same source", () => {
		const sources = [
			makeResult({ chunkId: 1, sourceId: "note.md", score: 0.8 }),
			makeResult({ chunkId: 2, sourceId: "note.md", score: 0.6 }),
		];
		const groups = groupSources(sources);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.chunks).toHaveLength(2);
	});

	it("tracks bestScore as max across chunks", () => {
		const sources = [
			makeResult({ chunkId: 1, sourceId: "a.md", score: 0.3 }),
			makeResult({ chunkId: 2, sourceId: "a.md", score: 0.9 }),
		];
		const groups = groupSources(sources);
		expect(groups[0]?.bestScore).toBe(0.9);
	});

	it("deduplicates headings within a group", () => {
		const sources = [
			makeResult({
				chunkId: 1,
				sourceId: "a.md",
				headingBreadcrumb: "Intro",
			}),
			makeResult({
				chunkId: 2,
				sourceId: "a.md",
				headingBreadcrumb: "Intro",
			}),
			makeResult({
				chunkId: 3,
				sourceId: "a.md",
				headingBreadcrumb: "Details",
			}),
		];
		const groups = groupSources(sources);
		expect(groups[0]?.headings).toEqual(["Intro", "Details"]);
	});

	it("sorts groups by bestScore descending", () => {
		const sources = [
			makeResult({ sourceId: "low.md", score: 0.2 }),
			makeResult({ sourceId: "high.md", score: 0.9 }),
			makeResult({ sourceId: "mid.md", score: 0.5 }),
		];
		const groups = groupSources(sources);
		expect(groups.map((g) => g.sourceId)).toEqual([
			"high.md",
			"mid.md",
			"low.md",
		]);
	});

	it("extracts filename for note displayName", () => {
		const sources = [makeResult({ sourceId: "folder/My Note.md" })];
		const groups = groupSources(sources);
		expect(groups[0]?.displayName).toBe("My Note");
	});

	it("extracts question text for flashcard displayName", () => {
		const sources = [
			makeResult({
				sourceType: "flashcard",
				sourceId: "card-123",
				content: "Q: What is X?\nA: Y",
			}),
		];
		const groups = groupSources(sources);
		expect(groups[0]?.displayName).toBe("What is X?");
	});
});

describe("stripMarkdown", () => {
	it("strips headings", () => {
		expect(stripMarkdown("## Hello")).toBe("Hello");
	});

	it("strips bold and italic", () => {
		expect(stripMarkdown("**bold** and *italic*")).toBe("bold and italic");
	});

	it("strips inline code", () => {
		expect(stripMarkdown("`code`")).toBe("code");
	});

	it("strips links", () => {
		expect(stripMarkdown("[text](https://example.com)")).toBe("text");
	});

	it("strips images", () => {
		expect(stripMarkdown("![alt](img.png)")).toBe("alt");
	});

	it("strips strikethrough", () => {
		expect(stripMarkdown("~~deleted~~")).toBe("deleted");
	});

	it("strips highlight", () => {
		expect(stripMarkdown("==marked==")).toBe("marked");
	});

	it("passes through plain text unchanged", () => {
		expect(stripMarkdown("plain text")).toBe("plain text");
	});
});
