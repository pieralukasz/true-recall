import { describe, expect, it } from "vitest";

import { resolvePanelKeyboardAction } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-keyboard";

describe("resolvePanelKeyboardAction", () => {
	it.each([
		["slash", { key: "/", mode: "list" as const }, "focus-search"],
		[
			"command search",
			{ key: "f", metaKey: true, mode: "list" as const },
			"focus-search",
		],
		["new card", { key: "n", mode: "list" as const }, "add-card"],
		["edit", { key: "e", mode: "detail" as const }, "edit-card"],
		["next", { key: "j", mode: "detail" as const }, "next-card"],
		["previous", { key: "ArrowUp", mode: "detail" as const }, "previous-card"],
		["help", { key: "?", mode: "list" as const }, "show-shortcuts"],
	])("resolves %s", (_label, input, expected) => {
		expect(resolvePanelKeyboardAction({ ...input, isEditingText: false })).toBe(
			expected,
		);
	});

	it("does not override text editing shortcuts", () => {
		expect(
			resolvePanelKeyboardAction({
				key: "a",
				metaKey: true,
				mode: "list",
				isEditingText: true,
			}),
		).toBeNull();
	});

	it("still allows command search while editing text", () => {
		expect(
			resolvePanelKeyboardAction({
				key: "f",
				ctrlKey: true,
				mode: "detail",
				isEditingText: true,
			}),
		).toBe("focus-search");
	});

	it("limits detail navigation shortcuts to detail mode", () => {
		expect(
			resolvePanelKeyboardAction({
				key: "j",
				mode: "list",
				isEditingText: false,
			}),
		).toBeNull();
	});
});
