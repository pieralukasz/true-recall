import { describe, expect, it, vi } from "vitest";

import {
	BUILTIN_CLOZE_ID,
	type Note,
} from "@true-recall/core/types/note.types";

import { createMockFlashcard } from "../../../../../../core/tests/mocks/fsrs.mocks";
import { CardActionsHandler } from "../../../../../src/features/study/ui/review/handlers/CardActionsHandler";
import type { ReviewApi } from "../../../../../src/store";

const editorSpies = vi.hoisted(() => ({
	openQuickNoteEditor: vi.fn(async () => ({ cancelled: true as const })),
}));

vi.mock(
	"@true-recall/obsidian/views/modal-window/open-quick-note-editor",
	() => editorSpies,
);

describe("CardActionsHandler.handleAddCopyOfCurrentFlashcard", () => {
	it("opens Add flashcard with the current note type and copied fields", async () => {
		const baseCard = createMockFlashcard({
			id: "card-1",
			sourceUid: "source-1",
		});
		const card = {
			...baseCard,
			noteId: "note-1",
			fsrs: { ...baseCard.fsrs, noteTypeId: BUILTIN_CLOZE_ID },
		};
		const note: Note = {
			id: "note-1",
			noteTypeId: BUILTIN_CLOZE_ID,
			fields: {
				Text: "{{c1::Warsaw}} is the capital of Poland",
				Extra: "Geography",
			},
			tags: [],
			sourceUid: "source-1",
		};
		const review = {
			getCurrentCard: () => card,
		} as unknown as ReviewApi;
		const plugin = { commandService: null } as never;
		const handler = new CardActionsHandler(
			{
				app: {} as never,
				getReview: () => review,
				flashcardManager: {} as never,
				fsrsService: {} as never,
				reviewService: {} as never,
				cardStore: {
					notes: { getById: vi.fn(() => note) },
				} as never,
				settings: {} as never,
				plugin,
			},
			{ onUpdateSchedulingPreview: vi.fn() },
		);

		await handler.handleAddCopyOfCurrentFlashcard();

		expect(editorSpies.openQuickNoteEditor).toHaveBeenCalledWith(plugin, {
			mode: "add",
			sourceUid: "source-1",
			excludeCardId: "card-1",
			defaultNoteTypeId: BUILTIN_CLOZE_ID,
			initialFields: note.fields,
		});
		const mode = editorSpies.openQuickNoteEditor.mock.calls[0]?.[1];
		expect(mode?.initialFields).not.toBe(note.fields);
	});
});
