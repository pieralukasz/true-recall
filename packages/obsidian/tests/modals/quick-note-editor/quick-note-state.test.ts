import { describe, expect, it } from "vitest";

import {
	createQuickNoteState,
	mapQuickNoteFields,
	quickNoteReducer,
} from "../../../src/modals/study/quick-note-editor/domain/quick-note-state";
import {
	canSaveQuickNote,
	isQuickNoteDirty,
} from "../../../src/modals/study/quick-note-editor/domain/quick-note-validation";

describe("Quick Note draft", () => {
	it("carries selected text when switching from Basic to Cloze and removes stale pins", () => {
		let state = createQuickNoteState(
			{ mode: "add", initialFields: { Front: "Question", Back: "Answer" } },
			["Front", "Back"],
		);
		state = quickNoteReducer(state, { type: "pin", name: "Back" });
		state = quickNoteReducer(state, {
			type: "noteType",
			id: "cloze",
			fieldNames: ["Text", "Extra"],
		});
		expect(state.fields).toEqual({ Text: "Question", Extra: "" });
		expect([...state.pinnedFields]).toEqual([]);
	});
	it("preserves matching fields before carrying text", () => {
		expect(
			mapQuickNoteFields({ Front: "Q", Text: "Existing" }, ["Text", "Extra"]),
		).toEqual({ Text: "Existing", Extra: "" });
	});
	it("retains pinned fields and clears the comment after Save & Add", () => {
		let state = createQuickNoteState(
			{ mode: "add", initialFields: { Front: "Q", Back: "A" } },
			["Front", "Back"],
		);
		state = quickNoteReducer(state, { type: "pin", name: "Back" });
		state = quickNoteReducer(state, { type: "comment", value: "Context" });
		state = quickNoteReducer(state, {
			type: "saved",
			fieldNames: ["Front", "Back"],
		});
		expect(state.fields).toEqual({ Front: "", Back: "A" });
		expect(state.userComment).toBe("");
		expect(state.focusFirstRequest).toBe(0);
	});
	it("requests focus after saving without pins", () => {
		const state = quickNoteReducer(
			createQuickNoteState({ mode: "add" }, ["Front"]),
			{ type: "saved", fieldNames: ["Front"] },
		);
		expect(state.focusFirstRequest).toBe(1);
	});
	it.each([
		["", false],
		["  ", false],
		["Question", true],
	])("validates the primary field: %s", (value, expected) => {
		expect(
			canSaveQuickNote({ Front: value, Back: "Answer" }, ["Front", "Back"]),
		).toBe(expected);
	});
	it("does not save a note type without fields", () => {
		expect(canSaveQuickNote({ Front: "Q" }, [])).toBe(false);
	});
	it("treats whitespace-only new drafts as clean but tracks a comment", () => {
		expect(isQuickNoteDirty({ mode: "add" }, { Front: "  " }, "")).toBe(false);
		expect(isQuickNoteDirty({ mode: "add" }, {}, "comment")).toBe(true);
	});
});
