import { describe, expect, it } from "vitest";

import {
	csvFilenameFor,
	escapeCsvField,
	flashcardsToCsv,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-csv";

describe("escapeCsvField", () => {
	it.each([
		["plain text", "plain", "plain"],
		["comma", "a,b", '"a,b"'],
		["quote", 'say "hi"', '"say ""hi"""'],
		["line break", "one\ntwo", '"one\ntwo"'],
		["empty", "", ""],
	])("handles %s", (_label, input, expected) => {
		expect(escapeCsvField(input)).toBe(expected);
	});
});

describe("flashcardsToCsv", () => {
	it("writes a header and one row per card", () => {
		const csv = flashcardsToCsv([
			{ question: "Q1", answer: "A1" },
			{ question: "a, b", answer: 'He said "no"\nthen left' },
		]);
		expect(csv).toBe(
			["Question,Answer", "Q1,A1", '"a, b","He said ""no""\nthen left"'].join(
				"\n",
			),
		);
	});

	it("writes only the header for no cards", () => {
		expect(flashcardsToCsv([])).toBe("Question,Answer");
	});
});

describe("csvFilenameFor", () => {
	it("uses the note name when available", () => {
		expect(csvFilenameFor("Biology")).toBe("Biology-flashcards.csv");
		expect(csvFilenameFor(undefined)).toBe("flashcards.csv");
	});
});
