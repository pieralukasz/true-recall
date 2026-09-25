import { describe, expect, it } from "vitest";

import {
	createQuickAddPanelMode,
	needsQuickAddDiscardConfirmation,
} from "../../../../../src/features/library/ui/panel/quick-add-panel";

describe("quick add panel", () => {
	it("creates an add-editor mode bound to the current note", () => {
		expect(createQuickAddPanelMode("note-uid")).toEqual({
			mode: "add",
			sourceUid: "note-uid",
		});
	});

	it.each([
		["clean editor", false, false],
		["dirty editor", true, true],
	])("requires confirmation for a %s", (_label, isDirty, expected) => {
		expect(needsQuickAddDiscardConfirmation(isDirty)).toBe(expected);
	});
});
