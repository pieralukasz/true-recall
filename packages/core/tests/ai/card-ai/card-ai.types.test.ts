import { describe, expect, it } from "vitest";

import { makeCardAIResponseSchema } from "../../../src/ai/card-ai/card-ai.types";

describe("makeCardAIResponseSchema", () => {
	it("accepts exactly the requested keys", () => {
		const schema = makeCardAIResponseSchema(["Front", "Back"]);
		expect(schema.parse({ Front: "Q", Back: "A" })).toEqual({
			Front: "Q",
			Back: "A",
		});
	});

	it("ignores extra keys", () => {
		const schema = makeCardAIResponseSchema(["Front", "Back"]);
		expect(schema.parse({ Front: "Q", Back: "A", Extra: "x" })).toEqual({
			Front: "Q",
			Back: "A",
		});
	});

	it("rejects when a requested key is missing", () => {
		const schema = makeCardAIResponseSchema(["Front", "Back"]);
		expect(() => schema.parse({ Front: "Q" })).toThrow();
	});

	it("accepts empty strings", () => {
		const schema = makeCardAIResponseSchema(["Front", "Back"]);
		expect(schema.parse({ Front: "Q", Back: "" }).Back).toBe("");
	});

	it("works for Cloze-style field names", () => {
		const schema = makeCardAIResponseSchema(["Text", "Extra"]);
		expect(schema.parse({ Text: "X", Extra: "Y" })).toEqual({
			Text: "X",
			Extra: "Y",
		});
	});
});
