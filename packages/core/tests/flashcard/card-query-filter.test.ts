import { describe, expect, it } from "vitest";
import { hasDisplayableContent } from "../../src/flashcard/data/card-query.service";
import { createTestCard } from "../persistence/sqlite/__setup__/test-database";

describe("hasDisplayableContent", () => {
	it("returns true for a card with a question", () => {
		const card = createTestCard({ question: "What is X?" });
		expect(hasDisplayableContent(card)).toBe(true);
	});

	it("returns false for a regular card with empty question", () => {
		const card = createTestCard({ question: "" });
		expect(hasDisplayableContent(card)).toBe(false);
	});

	it("returns false for a regular card with undefined question", () => {
		const card = { ...createTestCard(), question: undefined };
		expect(hasDisplayableContent(card)).toBe(false);
	});

	it("returns true for a note-review card with empty question", () => {
		const card = createTestCard({ question: "", cardType: "note-review" });
		expect(hasDisplayableContent(card)).toBe(true);
	});

	it("returns true for a note-review card with undefined question", () => {
		const card = {
			...createTestCard({ cardType: "note-review" }),
			question: undefined,
		};
		expect(hasDisplayableContent(card)).toBe(true);
	});
});
