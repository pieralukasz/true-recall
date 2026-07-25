import { describe, expect, it } from "vitest";

import { resolvePresetListIndex } from "../../src/features/assistant/ui/preset-list-keys";

describe("resolvePresetListIndex", () => {
	it("moves down and wraps past the last row", () => {
		expect(resolvePresetListIndex({ key: "ArrowDown" }, 0, 3)).toBe(1);
		expect(resolvePresetListIndex({ key: "ArrowDown" }, 2, 3)).toBe(0);
	});

	it("moves up and wraps past the first row", () => {
		expect(resolvePresetListIndex({ key: "ArrowUp" }, 2, 3)).toBe(1);
		expect(resolvePresetListIndex({ key: "ArrowUp" }, 0, 3)).toBe(2);
	});

	it("jumps to the ends", () => {
		expect(resolvePresetListIndex({ key: "Home" }, 2, 3)).toBe(0);
		expect(resolvePresetListIndex({ key: "End" }, 0, 3)).toBe(2);
	});

	it("falls through for keys it does not own", () => {
		expect(resolvePresetListIndex({ key: "Enter" }, 0, 3)).toBeNull();
		expect(resolvePresetListIndex({ key: "a" }, 0, 3)).toBeNull();
	});

	it("falls through when there are no rows", () => {
		expect(resolvePresetListIndex({ key: "ArrowDown" }, -1, 0)).toBeNull();
	});

	it("starts at the first row when nothing is focused yet", () => {
		expect(resolvePresetListIndex({ key: "ArrowDown" }, -1, 3)).toBe(0);
	});
});
