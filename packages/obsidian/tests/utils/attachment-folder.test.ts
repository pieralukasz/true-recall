import { describe, expect, it } from "vitest";

import { resolveAttachmentFolder } from "@true-recall/obsidian/utils/attachment-folder";

describe("resolveAttachmentFolder", () => {
	it("returns the override when it is set", () => {
		expect(resolveAttachmentFolder("Flashcards/Attachments", "Attachments")).toBe(
			"Flashcards/Attachments",
		);
	});

	it("falls back when the override is an empty string", () => {
		expect(resolveAttachmentFolder("", "Attachments")).toBe("Attachments");
	});

	it("falls back when the override is whitespace-only", () => {
		expect(resolveAttachmentFolder("   ", "Attachments")).toBe("Attachments");
	});

	it("trims the override before returning it", () => {
		expect(resolveAttachmentFolder("  Flashcards  ", "Attachments")).toBe(
			"Flashcards",
		);
	});
});
