import { describe, expect, it } from "vitest";

import { resolveAnkiMediaFolder } from "@true-recall/plugins/anki-import-export/anki-import/media-folder";

describe("resolveAnkiMediaFolder", () => {
	it("returns the override when it is set", () => {
		expect(
			resolveAnkiMediaFolder("Flashcards/Media", "Anki Import", ["Japanese"]),
		).toBe("Flashcards/Media");
	});

	it("builds the fallback from the import folder and top deck", () => {
		expect(resolveAnkiMediaFolder("", "Anki Import", ["Japanese"])).toBe(
			"Attachments/Anki Import/Japanese",
		);
	});

	it("uses only the top segment of a nested deck name", () => {
		expect(
			resolveAnkiMediaFolder("", "Anki Import", ["Japanese/Kanji/N5"]),
		).toBe("Attachments/Anki Import/Japanese");
	});

	it("replaces characters that are invalid in folder names", () => {
		expect(resolveAnkiMediaFolder("", "Anki Import", ['My: "Deck"?'])).toBe(
			"Attachments/Anki Import/My- -Deck--",
		);
	});

	it("falls back to 'import' when there are no decks", () => {
		expect(resolveAnkiMediaFolder("", "Anki Import", [])).toBe(
			"Attachments/Anki Import/import",
		);
	});
});
