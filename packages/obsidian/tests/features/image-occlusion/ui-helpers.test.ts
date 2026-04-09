import { describe, expect, it } from "vitest";

import {
	shouldImagePanelStartExpanded,
	truncateMiddlePath,
} from "../../../src/features/image-occlusion/ui-helpers";

describe("image occlusion ui helpers", () => {
	describe("shouldImagePanelStartExpanded", () => {
		it("starts expanded when image path is empty or whitespace", () => {
			expect(shouldImagePanelStartExpanded("")).toBe(true);
			expect(shouldImagePanelStartExpanded("   ")).toBe(true);
		});

		it("starts collapsed when image path is available", () => {
			expect(shouldImagePanelStartExpanded("assets/image.png")).toBe(false);
		});
	});

	describe("truncateMiddlePath", () => {
		it("returns unchanged value for short paths", () => {
			const value = "Source: notes/daily.md";
			expect(truncateMiddlePath(value, 56)).toBe(value);
		});

		it("truncates long paths with middle ellipsis while keeping length bound", () => {
			const value =
				"Source: 00 System/Knowledge Base/Long Directory/Subdirectory/VeryLongFileName.md";
			const truncated = truncateMiddlePath(value, 48);
			expect(truncated.length).toBeLessThanOrEqual(48);
			expect(truncated.includes("…")).toBe(true);
			expect(truncated.startsWith("Source:")).toBe(true);
			expect(truncated.endsWith("VeryLongFileName.md")).toBe(true);
		});

		it("falls back to head-only slicing for tiny max length", () => {
			expect(truncateMiddlePath("abcdefghi", 4)).toBe("abcd");
		});
	});
});
