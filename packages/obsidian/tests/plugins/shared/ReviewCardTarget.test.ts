import { describe, expect, it, vi } from "vitest";

import { ReviewCardTarget } from "@true-recall/plugins/shared/ReviewCardTarget";

function makePlugin(
	over: Partial<{
		card: {
			id: string;
			noteId: string;
			sourceUid?: string;
		} | null;
		note: { noteTypeId: string; fields: Record<string, string> };
		noteType: { id: string; name: string; fields: string[] };
		updateNoteFields: ReturnType<typeof vi.fn>;
	}> = {},
) {
	const card =
		over.card === undefined
			? { id: "c1", noteId: "n1", sourceUid: "uid-1" }
			: over.card;
	const note = over.note ?? {
		noteTypeId: "t1",
		fields: { Front: "q", Back: "a" },
	};
	const noteType = over.noteType ?? {
		id: "t1",
		name: "Basic",
		fields: ["Front", "Back"],
	};
	const updateNoteFields = over.updateNoteFields ?? vi.fn();
	return {
		store: { getState: () => ({ review: { getCurrentCard: () => card } }) },
		cardStore: {
			notes: { getById: vi.fn().mockReturnValue(note) },
			noteTypes: { getById: vi.fn().mockReturnValue(noteType) },
		},
		flashcardManager: { updateNoteFields },
	} as never;
}

describe("ReviewCardTarget", () => {
	it("projects note fields through the note type's field list", () => {
		expect(new ReviewCardTarget(makePlugin()).getFields()).toEqual({
			Front: "q",
			Back: "a",
		});
	});

	it("handles Cloze-style note types by field name", () => {
		const t = new ReviewCardTarget(
			makePlugin({
				note: {
					noteTypeId: "cz",
					fields: { Text: "{{c1::apple}}", Extra: "pome" },
				},
				noteType: { id: "cz", name: "Cloze", fields: ["Text", "Extra"] },
			}),
		);
		expect(t.getFields()).toEqual({ Text: "{{c1::apple}}", Extra: "pome" });
	});

	it("calls flashcardManager.updateNoteFields on apply and returns true", () => {
		const updateNoteFields = vi.fn();
		const ok = new ReviewCardTarget(makePlugin({ updateNoteFields })).apply({
			Front: "Q",
			Back: "A",
		});
		expect(updateNoteFields).toHaveBeenCalledWith("n1", {
			Front: "Q",
			Back: "A",
		});
		expect(ok).toBe(true);
	});

	it("returns false and does not call updateNoteFields when no card is in review", () => {
		const updateNoteFields = vi.fn();
		const ok = new ReviewCardTarget(
			makePlugin({ card: null, updateNoteFields }),
		).apply({ Front: "Q", Back: "A" });
		expect(updateNoteFields).not.toHaveBeenCalled();
		expect(ok).toBe(false);
	});

	it("exposes sourceUid and currentCardId", () => {
		const t = new ReviewCardTarget(makePlugin());
		expect(t.getSourceUid()).toBe("uid-1");
		expect(t.getCurrentCardId()).toBe("c1");
	});

	it("returns empty fields when no card is in review", () => {
		const t = new ReviewCardTarget(makePlugin({ card: null }));
		expect(t.getFields()).toEqual({});
		expect(t.getCurrentCardId()).toBeUndefined();
	});
});
