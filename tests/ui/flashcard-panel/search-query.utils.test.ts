import { describe, expect, it } from "vitest";
import {
	matchesCardSearch,
	normalizeSearchQuery,
} from "../../../src/features/library/ui/panel/utils/search-query.utils";

describe("search-query utils", () => {
	it("normalizes by trimming and lowercasing", () => {
		expect(normalizeSearchQuery("  TeSt Query  ")).toBe("test query");
	});

	it("matches card text case-insensitively", () => {
		expect(
			matchesCardSearch(
				"What is FSRS?",
				"Free Spaced Repetition Scheduler",
				"fsrs",
			),
		).toBe(true);
		expect(
			matchesCardSearch(
				"What is FSRS?",
				"Free Spaced Repetition Scheduler",
				"SCHEDULER",
			),
		).toBe(true);
	});

	it("returns true for empty/whitespace query", () => {
		expect(matchesCardSearch("Question", "Answer", "")).toBe(true);
		expect(matchesCardSearch("Question", "Answer", "   ")).toBe(true);
	});

	it("returns false when query is not present", () => {
		expect(matchesCardSearch("Question", "Answer", "not-found")).toBe(false);
	});
});
