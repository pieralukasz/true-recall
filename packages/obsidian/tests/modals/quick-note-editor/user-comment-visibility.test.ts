import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";

import { shouldShowUserCommentField } from "../../../src/modals/study/quick-note-editor/domain/user-comment-visibility";

describe("My Note field visibility", () => {
	it("is shown by default so existing users keep the field", () => {
		expect(DEFAULT_SETTINGS.showEditorUserNote).toBe(true);
	});

	it("shows the field whenever the setting is on", () => {
		expect(shouldShowUserCommentField(true, "", false)).toBe(true);
	});

	it("hides an empty field when the setting is off", () => {
		expect(shouldShowUserCommentField(false, "", false)).toBe(false);
		expect(shouldShowUserCommentField(false, "  \n ", false)).toBe(false);
	});

	it("reveals the field after Cmd/Ctrl+K even when the setting is off", () => {
		expect(shouldShowUserCommentField(false, "", true)).toBe(true);
	});

	it("never hides a saved note", () => {
		expect(shouldShowUserCommentField(false, "Check the source", false)).toBe(
			true,
		);
	});
});
