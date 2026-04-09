import { describe, expect, it } from "vitest";

import { assessTypedAnswer } from "../../src/helpers/answer-assessment";

describe("assessTypedAnswer", () => {
	it("normalizes markdown, case and whitespace", () => {
		const result = assessTypedAnswer(
			"**Hitler** invaded   Poland",
			"hitler invaded poland",
		);
		expect(result.score).toBe(100);
		expect(result.diff.every((token) => token.type === "match")).toBe(true);
	});

	it("marks missing and extra words with LCS diff", () => {
		const result = assessTypedAnswer("alpha beta gamma", "alpha gamma delta");

		expect(result.score).toBe(67);
		expect(result.diff).toEqual([
			{ text: "alpha", type: "match" },
			{ text: "beta", type: "missing" },
			{ text: "gamma", type: "match" },
			{ text: "delta", type: "extra" },
		]);
	});

	it("returns 100 when both answers are effectively empty", () => {
		const result = assessTypedAnswer("", "");
		expect(result.score).toBe(100);
		expect(result.diff).toEqual([]);
	});
});
