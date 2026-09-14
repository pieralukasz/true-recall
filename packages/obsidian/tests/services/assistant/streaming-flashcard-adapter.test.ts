import { describe, expect, it, vi } from "vitest";

import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";

import { createStreamingFlashcardAdapter } from "../../../src/services/assistant/streaming-flashcard-adapter";

function createManager() {
	const frontmatter = {
		getSourceNoteUid: vi.fn().mockResolvedValue("uid"),
		setSourceNoteUid: vi.fn().mockResolvedValue(undefined),
		generateUid: vi.fn(() => "new-uid"),
	};
	const manager = {
		getFrontmatterService: () => frontmatter,
		getNoteTypeById: vi.fn(),
		getNoteTypeBySlug: vi.fn(),
		createNote: vi.fn(() => ({ cards: [{ id: "card-1" }] })),
	};
	return {
		frontmatter,
		manager,
		adapter: createStreamingFlashcardAdapter(
			manager as unknown as FlashcardManager,
		),
	};
}
describe("streaming flashcard adapter", () => {
	it("passes a path to the platform-agnostic frontmatter service", async () => {
		const { adapter, frontmatter } = createManager();
		const service = adapter.getFrontmatterService();
		await expect(
			service.getSourceNoteUid({ path: "notes/Source.md" }),
		).resolves.toBe("uid");
		await service.setSourceNoteUid({ path: "notes/Source.md" }, "new-uid");
		expect(frontmatter.getSourceNoteUid).toHaveBeenCalledWith(
			"notes/Source.md",
		);
		expect(frontmatter.setSourceNoteUid).toHaveBeenCalledWith(
			"notes/Source.md",
			"new-uid",
		);
	});
	it("normalizes optional display text while preserving the created card ID", () => {
		const { adapter, manager } = createManager();
		const params = {
			noteTypeId: "builtin-basic",
			fields: { Front: "Q" },
			sourceUid: "uid",
			createdVia: "ai",
			skipDuplicates: true,
		};
		expect(adapter.createNote(params)).toEqual({
			cards: [{ id: "card-1", question: "", answer: "" }],
		});
		expect(manager.createNote).toHaveBeenCalledWith(params);
	});
});
