import { describe, expect, it } from "vitest";

import {
	getFirstPanelImageRef,
	isExternalPanelImageRef,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-image.utils";

describe("getFirstPanelImageRef", () => {
	it.each([
		["wiki embed", "Front ![[Images/photo.png|300]]", "Images/photo.png"],
		["markdown image", "![diagram](assets/a.png)", "assets/a.png"],
		[
			"angle-bracket URL",
			"![](<https://example.com/a b.png>)",
			"https://example.com/a b.png",
		],
		["HTML image", '<img src="assets/card.webp">', "assets/card.webp"],
	] as const)("extracts a %s", (_name, content, expected) => {
		expect(getFirstPanelImageRef(content)).toBe(expected);
	});

	it("checks the answer when the question has no image", () => {
		expect(getFirstPanelImageRef("Question", "![[answer.png]]")).toBe(
			"answer.png",
		);
	});

	it("returns null when no image exists", () => {
		expect(getFirstPanelImageRef("Plain text")).toBeNull();
	});
});

describe("isExternalPanelImageRef", () => {
	it.each([
		"https://example.com/a.png",
		"data:image/png;base64,a",
		"app://a",
	])("accepts %s", (ref) => expect(isExternalPanelImageRef(ref)).toBe(true));

	it("rejects vault paths", () => {
		expect(isExternalPanelImageRef("assets/a.png")).toBe(false);
	});
});
