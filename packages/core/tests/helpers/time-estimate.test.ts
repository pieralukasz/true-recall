import { describe, expect, it } from "vitest";
import {
	estimateStudyMinutes,
	formatEstimatedTime,
} from "../../src/helpers/time-estimate";

describe("estimateStudyMinutes", () => {
	it("returns 0 when all counts are zero", () => {
		expect(estimateStudyMinutes(0, 0, 0)).toBe(0);
	});

	it("estimates due-only cards (10 due × 8s = 80s → 2 min)", () => {
		expect(estimateStudyMinutes(10, 0, 0)).toBe(2);
	});

	it("estimates new-only cards (5 new × 30s = 150s → 3 min)", () => {
		expect(estimateStudyMinutes(0, 5, 0)).toBe(3);
	});

	it("estimates learning-only cards (4 learning × 15s = 60s → 1 min)", () => {
		expect(estimateStudyMinutes(0, 0, 4)).toBe(1);
	});

	it("estimates mixed cards (10×8 + 5×30 + 4×15 = 290s → 5 min)", () => {
		expect(estimateStudyMinutes(10, 5, 4)).toBe(5);
	});
});

describe("formatEstimatedTime", () => {
	it("formats 0 minutes as '<1 min'", () => {
		expect(formatEstimatedTime(0)).toBe("<1 min");
	});

	it("formats 45 minutes as '45 min'", () => {
		expect(formatEstimatedTime(45)).toBe("45 min");
	});

	it("formats exactly 60 minutes as '1h'", () => {
		expect(formatEstimatedTime(60)).toBe("1h");
	});

	it("formats 90 minutes as '1h 30m'", () => {
		expect(formatEstimatedTime(90)).toBe("1h 30m");
	});

	it("formats 125 minutes as '2h 5m'", () => {
		expect(formatEstimatedTime(125)).toBe("2h 5m");
	});
});
