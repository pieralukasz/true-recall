import { describe, expect, it } from "vitest";

import {
	hardStreakScore,
	hasHardStreak,
	isGraduatable,
} from "@true-recall/obsidian/features/child-cards/child-graduation";

describe("isGraduatable", () => {
	it("requires the whole streak to be Good or Easy, newest first", () => {
		expect(isGraduatable([4, 3], 2)).toBe(true);
		expect(isGraduatable([3, 4, 3], 3)).toBe(true);
	});

	it("rejects a streak broken by Hard or Again", () => {
		expect(isGraduatable([3, 2], 2)).toBe(false);
		expect(isGraduatable([3, 1], 2)).toBe(false);
	});

	it("rejects young cards and non-positive streaks", () => {
		expect(isGraduatable([3], 2)).toBe(false);
		expect(isGraduatable([3, 3], 0)).toBe(false);
	});
});

describe("hasHardStreak", () => {
	it("fires only on a run of Hard ratings", () => {
		expect(hasHardStreak([2, 2, 2], 3)).toBe(true);
		expect(hasHardStreak([2, 3, 2], 3)).toBe(false);
		expect(hasHardStreak([2, 2], 3)).toBe(false);
	});

	it("counts Again as two Hard", () => {
		expect(hardStreakScore([1])).toBe(2);
		expect(hasHardStreak([1, 2, 2], 4)).toBe(true);
		expect(hasHardStreak([1, 2], 4)).toBe(false);
	});

	it("stops scoring at the first Good or Easy", () => {
		expect(hardStreakScore([1, 2, 3, 1])).toBe(3);
	});

	it("keeps Again in the run but adds nothing when the score is 0", () => {
		expect(hardStreakScore([1, 2], 0)).toBe(1);
		expect(hasHardStreak([1, 1, 1, 1], 4, 0)).toBe(false);
		expect(hasHardStreak([1, 2, 2, 2], 3, 0)).toBe(true);
	});
});
