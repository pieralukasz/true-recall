import { describe, expect, it } from "vitest";

import {
	getAnswerMatchSnippet,
	matchesCardSearch,
	normalizeFullText,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-list.utils";

describe("normalizeFullText", () => {
	it.each([
		["diacritics", "**Zażółć** gęślą", "zazołc gesla"],
		["Markdown links", "[Event horizon](note.md)", "event horizon"],
		["whitespace", "  many\n spaces  ", "many spaces"],
	])("normalizes %s", (_description, input, expected) => {
		expect(normalizeFullText(input)).toBe(expected);
	});
});

describe("matchesCardSearch", () => {
	it("matches all query terms across question and answer", () => {
		expect(
			matchesCardSearch(
				"What is an event horizon?",
				"The boundary around a black hole.",
				"event boundary",
			),
		).toBe(true);
	});

	it("matches Polish text without requiring diacritics", () => {
		expect(
			matchesCardSearch("Czym jest próżnia?", "Brakiem materii", "proznia"),
		).toBe(true);
	});

	it("ignores Markdown syntax", () => {
		expect(matchesCardSearch("A **black hole**", "Answer", "black hole")).toBe(
			true,
		);
	});

	it("rejects a query with a missing term", () => {
		expect(matchesCardSearch("Black hole", "Gravity", "black radiation")).toBe(
			false,
		);
	});
});

describe("getAnswerMatchSnippet", () => {
	it("returns a compact answer excerpt when the answer matches", () => {
		const answer = `${"prefix ".repeat(20)}singularity${" suffix".repeat(20)}`;
		const result = getAnswerMatchSnippet(answer, "singularity", 60);

		expect(result).toContain("singularity");
		expect(result?.startsWith("…")).toBe(true);
		expect(result?.endsWith("…")).toBe(true);
	});

	it("returns null when only the question matches", () => {
		expect(getAnswerMatchSnippet("Nothing can escape", "horizon")).toBeNull();
	});
});
