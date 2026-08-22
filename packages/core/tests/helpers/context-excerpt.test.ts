import { describe, expect, it } from "vitest";

import {
	extractKeywords,
	selectRelevantSections,
} from "../../src/helpers/context-excerpt";

describe("extractKeywords", () => {
	it("keeps unique lowercase content words longer than 3 chars", () => {
		const keywords = extractKeywords("What is ATP synthase? ATP is energy");
		expect(keywords).toContain("synthase");
		expect(keywords).toContain("energy");
		expect(keywords).toContain("what");
		expect(keywords).not.toContain("atp");
		expect(keywords).not.toContain("is");
		expect(keywords.filter((k) => k === "what")).toHaveLength(1);
	});

	it("strips markdown syntax before splitting", () => {
		const keywords = extractKeywords("**Mitochondria** are [[organelles]]");
		expect(keywords).toContain("mitochondria");
		expect(keywords).toContain("organelles");
	});
});

describe("selectRelevantSections", () => {
	const section = (title: string, body: string) => `# ${title}\n${body}`;

	it("returns short notes whole", () => {
		const content = section("Intro", "Short note about mitochondria.");
		expect(selectRelevantSections(content, ["mitochondria"], 10000)).toBe(
			content,
		);
	});

	it("picks the heading sections with keyword matches, in document order", () => {
		const intro = section("Intro", "General overview.".repeat(5));
		const relevant1 = section("Energy", "Mitochondria produce energy via ATP.");
		const filler = section("History", "Discovered long ago.".repeat(5));
		const relevant2 = section("Details", "The mitochondria matrix hosts ATP.");
		const content = [intro, relevant1, filler, relevant2].join("\n");

		const maxChars = relevant1.length + relevant2.length + 2;
		const result = selectRelevantSections(
			content,
			["mitochondria"],
			maxChars,
		);

		expect(result).toContain("Mitochondria produce energy");
		expect(result).toContain("matrix hosts ATP");
		expect(result).not.toContain("Discovered long ago");
		expect(result.indexOf("Energy")).toBeLessThan(result.indexOf("Details"));
	});

	it("falls back to a head slice when the note has no headings", () => {
		const content = "plain text without headings ".repeat(50);
		const result = selectRelevantSections(content, ["nothing"], 100);
		expect(result).toBe(content.slice(0, 100));
		expect(result.length).toBe(100);
	});

	it("falls back to a head slice when nothing matches", () => {
		const content = [
			section("One", "alpha ".repeat(30)),
			section("Two", "beta ".repeat(30)),
		].join("\n");
		const result = selectRelevantSections(content, ["zzzzz"], 120);
		expect(result).toBe(content.slice(0, 120));
	});

	it("truncates the single best section when it exceeds maxChars", () => {
		const big = section("Match", `mitochondria ${"x".repeat(500)}`);
		const other = section("Other", "unrelated ".repeat(40));
		const content = [other, big].join("\n");

		const result = selectRelevantSections(content, ["mitochondria"], 80);
		expect(result.length).toBeLessThanOrEqual(80);
		expect(result).toContain("mitochondria");
	});

	it("never exceeds maxChars", () => {
		const content = Array.from({ length: 10 }, (_, i) =>
			section(`S${i}`, `keyword body ${i} `.repeat(20)),
		).join("\n");
		const result = selectRelevantSections(content, ["keyword"], 300);
		expect(result.length).toBeLessThanOrEqual(300);
	});
});
