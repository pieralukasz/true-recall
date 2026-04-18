import { describe, expect, it } from "vitest";

import { PolishResponseSchema } from "../../../src/ai/polish/card-polish.types";
import { buildPolishMessages } from "../../../src/ai/polish/card-polish-prompts";

describe("PolishResponseSchema", () => {
	it("accepts a valid response", () => {
		const parsed = PolishResponseSchema.parse({ front: "Q", back: "A" });
		expect(parsed).toEqual({ front: "Q", back: "A" });
	});

	it("rejects empty front", () => {
		expect(() =>
			PolishResponseSchema.parse({ front: "", back: "A" }),
		).toThrow();
	});

	it("rejects missing back", () => {
		expect(() => PolishResponseSchema.parse({ front: "Q" })).toThrow();
	});
});

describe("buildPolishMessages", () => {
	it("includes system prompt, JSON contract, and card payload", () => {
		const msgs = buildPolishMessages({
			prompt: "Fix markdown formatting.",
			cardFront: "What is FSRS?",
			cardBack: "Free Spaced Repetition Scheduler",
		});
		expect(msgs).toHaveLength(2);
		expect(msgs[0].role).toBe("system");
		expect(msgs[0].content).toContain("Fix markdown formatting.");
		expect(msgs[0].content).toContain("JSON");
		expect(msgs[0].content).toContain('"front"');
		expect(msgs[0].content).toContain('"back"');
		expect(msgs[1].role).toBe("user");
		expect(msgs[1].content).toContain("What is FSRS?");
		expect(msgs[1].content).toContain("Free Spaced Repetition Scheduler");
	});
});
