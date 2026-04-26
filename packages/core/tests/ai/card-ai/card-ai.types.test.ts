import { describe, expect, it } from "vitest";

import {
	deepEqualFields,
	makeCardAIArrayResponseSchema,
} from "../../../src/ai/card-ai/card-ai.types";

describe("makeCardAIArrayResponseSchema", () => {
	it("accepts a single-element array with the requested keys", () => {
		const schema = makeCardAIArrayResponseSchema(["Front", "Back"]);
		expect(schema.parse([{ Front: "Q", Back: "A" }])).toEqual([
			{ Front: "Q", Back: "A" },
		]);
	});

	it("accepts a multi-element array", () => {
		const schema = makeCardAIArrayResponseSchema(["Front", "Back"]);
		expect(
			schema.parse([
				{ Front: "Q1", Back: "A1" },
				{ Front: "Q2", Back: "A2" },
			]),
		).toEqual([
			{ Front: "Q1", Back: "A1" },
			{ Front: "Q2", Back: "A2" },
		]);
	});

	it("ignores extra keys per element (passthrough)", () => {
		const schema = makeCardAIArrayResponseSchema(["Front", "Back"]);
		expect(schema.parse([{ Front: "Q", Back: "A", Extra: "x" }])).toEqual([
			{ Front: "Q", Back: "A" },
		]);
	});

	it("rejects when a requested key is missing in any element", () => {
		const schema = makeCardAIArrayResponseSchema(["Front", "Back"]);
		expect(() =>
			schema.parse([{ Front: "Q1", Back: "A1" }, { Front: "Q2" }]),
		).toThrow();
	});

	it("rejects empty array (min(1))", () => {
		const schema = makeCardAIArrayResponseSchema(["Front", "Back"]);
		expect(() => schema.parse([])).toThrow();
	});

	it("rejects single object (regression — schema enforces array shape)", () => {
		const schema = makeCardAIArrayResponseSchema(["Front", "Back"]);
		const result = schema.safeParse({ Front: "Q", Back: "A" });
		expect(result.success).toBe(false);
	});

	it("accepts empty strings inside elements", () => {
		const schema = makeCardAIArrayResponseSchema(["Front", "Back"]);
		expect(schema.parse([{ Front: "Q", Back: "" }])[0].Back).toBe("");
	});

	it("throws when fieldNames is empty", () => {
		expect(() => makeCardAIArrayResponseSchema([])).toThrow();
	});

	it("works for Cloze-style field names", () => {
		const schema = makeCardAIArrayResponseSchema(["Text", "Extra"]);
		expect(schema.parse([{ Text: "X", Extra: "Y" }])).toEqual([
			{ Text: "X", Extra: "Y" },
		]);
	});
});

describe("deepEqualFields", () => {
	it("returns true for identical fields", () => {
		expect(
			deepEqualFields({ Front: "x", Back: "y" }, { Front: "x", Back: "y" }),
		).toBe(true);
	});

	it("treats trailing whitespace as equal (semantic noop)", () => {
		expect(deepEqualFields({ Front: "x" }, { Front: "x " })).toBe(true);
	});

	it("treats trailing newline as equal", () => {
		expect(deepEqualFields({ Front: "x\n" }, { Front: "x" })).toBe(true);
	});

	it("treats leading whitespace as equal", () => {
		expect(deepEqualFields({ Front: "  x" }, { Front: "x" })).toBe(true);
	});

	it("treats missing key + empty key as equal", () => {
		expect(deepEqualFields({ Front: "x" }, { Front: "x", Back: "" })).toBe(
			true,
		);
	});

	it("returns false for internal whitespace differences (semantic diff)", () => {
		expect(deepEqualFields({ Front: "x y" }, { Front: "x  y" })).toBe(false);
	});

	it("returns false for case differences", () => {
		expect(deepEqualFields({ Front: "x" }, { Front: "X" })).toBe(false);
	});

	it("returns false when fields differ structurally", () => {
		expect(deepEqualFields({ Front: "x" }, { Back: "x" })).toBe(false);
	});
});
