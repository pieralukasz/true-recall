import type { WorkloadDecision } from "@true-recall/core/metrics/fsrs-tools";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	buildTargetReferences,
	describeDrift,
	describeSuggestion,
	describeTargetConsequence,
	sliderMax,
} from "../../src/settings/tabs/fsrs/target-copy";

function createDecision(
	overrides: Partial<WorkloadDecision> = {},
): WorkloadDecision {
	return {
		steadyStatePerDay: 47,
		backlogSize: 1000,
		targetFloor: 48,
		medianPace: 140,
		p75Pace: 190,
		activeDays: 30,
		suggestedTarget: 140,
		usedPaceFallback: false,
		catchUp: { days: 11, date: "2026-02-12" },
		effectiveTarget: 140,
		...overrides,
	};
}

describe("describeTargetConsequence", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows the catch-up date when the target clears the backlog", () => {
		const text = describeTargetConsequence(createDecision(), 147);

		expect(text).toContain("1000");
		expect(text).toContain("2026-02-11");
	});

	it("warns when the target is under water", () => {
		const text = describeTargetConsequence(createDecision(), 40);

		expect(text).toContain("keep growing");
	});

	it("reports a clear state without a backlog", () => {
		const text = describeTargetConsequence(
			createDecision({ backlogSize: 0 }),
			100,
		);

		expect(text).toContain("No backlog");
	});
});

describe("describeSuggestion", () => {
	it("explains the pace anchor in the normal case", () => {
		expect(describeSuggestion(createDecision())).toContain("median pace");
	});

	it("explains the fallback when history is thin", () => {
		const text = describeSuggestion(
			createDecision({ usedPaceFallback: true, suggestedTarget: 151 }),
		);

		expect(text).toContain("forecast average");
		expect(text).toContain("151");
	});
});

describe("buildTargetReferences", () => {
	it("returns floor, median, and good-days chips in order", () => {
		const refs = buildTargetReferences(createDecision());

		expect(refs.map((r) => r.value)).toEqual([48, 140, 190]);
	});
});

describe("describeDrift", () => {
	it("nudges when the target exceeds the good-days pace", () => {
		expect(describeDrift(createDecision(), 250)).toContain(
			"above your good-days pace",
		);
	});

	it("stays quiet at or below the good-days pace", () => {
		expect(describeDrift(createDecision(), 190)).toBe(null);
	});

	it("stays quiet without trustworthy pace history", () => {
		expect(
			describeDrift(createDecision({ usedPaceFallback: true }), 250),
		).toBe(null);
	});
});

describe("sliderMax", () => {
	it("scales past the largest anchor and rounds up to tens", () => {
		expect(sliderMax(createDecision(), 100)).toBe(290);
	});

	it("never drops below 80 for tiny collections", () => {
		const tiny = createDecision({
			steadyStatePerDay: 1,
			targetFloor: 1,
			medianPace: 5,
			p75Pace: 8,
			suggestedTarget: 5,
			backlogSize: 0,
		});

		expect(sliderMax(tiny, 10)).toBe(80);
	});
});
