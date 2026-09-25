import { describe, expect, it } from "vitest";

import { markerLineRanges } from "../../../src/features/markdown-flashcards/marker-hiding";

const marker = '<!-- true-recall: {"v":1,"id":"x"} -->';

describe("Markdown flashcard marker hiding", () => {
	it("hides only whole marker lines", () => {
		const lines = [
			"Q",
			"??",
			"A",
			marker,
			"",
			`text ${marker}`,
			"<!-- other -->",
		];
		// offsets: Q=0-1, ??=2-4, A=5-6, marker=7-(7+len)
		expect(markerLineRanges(lines)).toEqual([[7, 7 + marker.length]]);
	});
	it("shows a marker while the cursor or selection touches its line", () => {
		const lines = ["A", marker, "B", marker];
		const second = 2 + marker.length + 1 + 2;
		expect(markerLineRanges(lines, [{ from: 5, to: 5 }])).toEqual([
			[second, second + marker.length],
		]);
		expect(markerLineRanges(lines, [{ from: 0, to: second + 3 }])).toEqual([]);
	});
});
