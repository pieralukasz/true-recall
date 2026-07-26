import { describe, expect, it } from "vitest";

import {
	readNumber,
	readProposalTarget,
	readString,
	readStringRecord,
	readStringRecordArray,
} from "../../../src/ai/assistant/tool-args";

describe("readString", () => {
	it("returns a string value unchanged", () => {
		expect(readString({ path: "Notes/A.md" }, "path")).toBe("Notes/A.md");
	});

	it.each([
		["number", 42, "42"],
		["boolean", true, "true"],
	])("coerces a %s primitive", (_label, value, expected) => {
		expect(readString({ code: value }, "code")).toBe(expected);
	});

	it.each([
		["object", { a: 1 }],
		["array", ["a"]],
		["null", null],
		["undefined", undefined],
	])("falls back rather than stringifying a %s", (_label, value) => {
		expect(readString({ path: value }, "path")).toBe("");
	});

	it("uses the supplied fallback for a missing key", () => {
		expect(readString({}, "title", "Untitled")).toBe("Untitled");
	});
});

describe("readNumber", () => {
	it("returns a finite number", () => {
		expect(readNumber({ count: 12 }, "count", 6)).toBe(12);
	});

	it.each([
		["a numeric string", "12"],
		["NaN", Number.NaN],
		["Infinity", Number.POSITIVE_INFINITY],
		["a missing key", undefined],
	])("falls back for %s", (_label, value) => {
		expect(readNumber({ count: value }, "count", 6)).toBe(6);
	});
});

describe("readStringRecord", () => {
	it("keeps string entries and coerces primitives", () => {
		expect(readStringRecord({ Front: "Q", Back: 7, Extra: false })).toEqual({
			Front: "Q",
			Back: "7",
			Extra: "false",
		});
	});

	it("drops structural values instead of writing [object Object]", () => {
		expect(readStringRecord({ Front: { nested: 1 }, Back: "A" })).toEqual({
			Back: "A",
		});
	});

	it.each([
		["null", null],
		["undefined", undefined],
		["a string", "Front"],
	])("returns an empty record for %s", (_label, value) => {
		expect(readStringRecord(value)).toEqual({});
	});
});

describe("readStringRecordArray", () => {
	it("normalizes every element", () => {
		expect(readStringRecordArray([{ Front: "Q" }, { Front: 2 }])).toEqual([
			{ Front: "Q" },
			{ Front: "2" },
		]);
	});

	it("returns an empty array for a non-array", () => {
		expect(readStringRecordArray({ Front: "Q" })).toEqual([]);
	});
});

describe("readProposalTarget", () => {
	it("accepts a note target", () => {
		expect(readProposalTarget({ kind: "note", path: "Notes/A.md" })).toEqual({
			kind: "note",
			path: "Notes/A.md",
		});
	});

	it("accepts a card-field target", () => {
		const target = {
			kind: "card-field",
			cardId: "card-1",
			noteId: "note-1",
			field: "Back",
		};
		expect(readProposalTarget(target)).toEqual(target);
	});

	it("drops unknown keys from a card-field target", () => {
		const result = readProposalTarget({
			kind: "card-field",
			cardId: "card-1",
			noteId: "note-1",
			field: "Back",
			injected: "ignored",
		});
		expect(result).not.toHaveProperty("injected");
	});

	it.each([
		["an unknown kind", { kind: "deck", path: "Notes/A.md" }],
		["a note target without a path", { kind: "note" }],
		["a note target with a non-string path", { kind: "note", path: 3 }],
		[
			"a card-field target missing noteId",
			{ kind: "card-field", cardId: "card-1", field: "Back" },
		],
		["no kind at all", { path: "Notes/A.md" }],
		["null", null],
		["a string", "note"],
	])("returns null for %s", (_label, value) => {
		expect(readProposalTarget(value)).toBeNull();
	});
});
