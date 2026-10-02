import { describe, expect, it } from "vitest";

import {
	isEditableTarget,
	isInActiveLeaf,
} from "@true-recall/obsidian/features/library/ui/browser/hooks/useKeyboardNav";

function root(leafClasses: string[] | null) {
	return {
		closest: () =>
			leafClasses
				? { classList: { contains: (c: string) => leafClasses.includes(c) } }
				: null,
	};
}

describe("isInActiveLeaf", () => {
	it("is true inside the focused workspace leaf", () => {
		expect(isInActiveLeaf(root(["workspace-leaf", "mod-active"]))).toBe(true);
	});

	it("is false while another leaf has focus", () => {
		expect(isInActiveLeaf(root(["workspace-leaf"]))).toBe(false);
	});

	it("is true outside a workspace leaf", () => {
		expect(isInActiveLeaf(root(null))).toBe(true);
	});

	it("is false before the root is mounted", () => {
		expect(isInActiveLeaf(null)).toBe(false);
	});
});

describe("isEditableTarget", () => {
	it.each([
		["input", { tagName: "INPUT" }, true],
		["textarea", { tagName: "TEXTAREA" }, true],
		["select", { tagName: "SELECT" }, true],
		["contenteditable", { tagName: "DIV", isContentEditable: true }, true],
		["plain element", { tagName: "DIV", isContentEditable: false }, false],
		["no target", null, false],
	])("%s -> %s", (_label, target, expected) => {
		expect(isEditableTarget(target)).toBe(expected);
	});
});
