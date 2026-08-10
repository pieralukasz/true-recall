/**
 * R-Mode wiring inside buildQueueOptions.
 *
 * This is the seam where a missing session size used to be read as "R-Mode
 * off", silently handing back a due-date queue while the mode was on. These
 * tests exist to keep that failure from coming back.
 */

import { describe, expect, it, vi } from "vitest";

import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import type {
	FSRSPreset,
	RModeSettings,
	TrueRecallSettings,
} from "@true-recall/core/types/settings.types";

import { buildQueueOptions } from "../../../../../src/features/study/ui/review/helpers/session-helpers";
import type { SessionFilters } from "../../../../../src/features/study/ui/review/review.types";

const R_MODE_ON: RModeSettings = {
	enabled: true,
	defaultSessionSize: 30,
	comfortMix: 0.3,
	ceilingOffset: 0.05,
	urgentBelow: 0.5,
};

function makeSettings(
	overrides: Partial<TrueRecallSettings> = {},
): TrueRecallSettings {
	return {
		newCardsPerDay: 20,
		reviewsPerDay: 200,
		newCardOrder: "oldest-first" as const,
		reviewOrder: "due-date" as const,
		newReviewMix: "mix-with-reviews" as const,
		dayStartHour: 4,
		fsrsRequestRetention: 0.9,
		temporaryCustomStudyDecks: [],
		rMode: R_MODE_ON,
		...overrides,
	} as TrueRecallSettings;
}

function makePreset(overrides: Partial<FSRSPreset> = {}): FSRSPreset {
	return {
		id: "p",
		name: "Test",
		requestRetention: 0.8,
		maximumInterval: 36500,
		weights: null,
		learningSteps: [1, 10],
		relearningSteps: [10],
		newCardsPerDay: 10,
		reviewsPerDay: 100,
		createdAt: 0,
		lastOptimization: null,
		lastOptimizationReviewCount: null,
		lastOptimizationMetrics: null,
		...overrides,
	} as FSRSPreset;
}

function makeSessionPersistence(): SessionPersistenceService {
	return {
		getReviewedToday: vi.fn(() => new Set<string>()),
		getNewCardsStudiedToday: vi.fn(() => 0),
		getReviewCardsCompletedToday: vi.fn(() => 0),
		getTodayProgressByPreset: vi.fn(() => new Map()),
		getCardsRatedAgainWithinDays: vi.fn(() => new Set<string>()),
	} as unknown as SessionPersistenceService;
}

const sp = makeSessionPersistence();
const filters = (overrides: Partial<SessionFilters> = {}): SessionFilters => ({
	...overrides,
});

describe("buildQueueOptions — R-Mode off", () => {
	const settings = makeSettings({ rMode: { ...R_MODE_ON, enabled: false } });

	it("produces no rMode options even when a size is supplied", () => {
		const result = buildQueueOptions(
			filters({ rModeTargetCount: 20 }),
			settings,
			sp,
		);

		expect(result.rMode).toBeUndefined();
	});

	it("tolerates settings saved before R-Mode existed", () => {
		// Reproduces a data.json written before the rMode block existed.
		const { rMode: _absent, ...withoutBlock } = makeSettings();
		const legacy = withoutBlock as TrueRecallSettings;

		expect(() =>
			buildQueueOptions(filters({ rModeTargetCount: 20 }), legacy, sp),
		).not.toThrow();
		expect(
			buildQueueOptions(filters({ rModeTargetCount: 20 }), legacy, sp).rMode,
		).toBeUndefined();
	});
});

describe("buildQueueOptions — R-Mode on", () => {
	const settings = makeSettings();

	it("passes the requested session size through", () => {
		const result = buildQueueOptions(
			filters({ rModeTargetCount: 12 }),
			settings,
			sp,
		);

		expect(result.rMode?.targetCount).toBe(12);
	});

	it("uses the default size when the entry point states none", () => {
		const result = buildQueueOptions(filters(), settings, sp);

		expect(result.rMode?.targetCount).toBe(30);
	});

	it("keeps an explicit zero, so new and learning cards still get a session", () => {
		const result = buildQueueOptions(
			filters({ rModeTargetCount: 0 }),
			settings,
			sp,
		);

		expect(result.rMode?.targetCount).toBe(0);
	});

	it("never falls back to the due queue while the mode is on", () => {
		for (const size of [undefined, 0, -5]) {
			const result = buildQueueOptions(
				filters({ rModeTargetCount: size }),
				settings,
				sp,
			);
			expect(result.rMode, `size ${String(size)}`).toBeDefined();
		}
	});

	it("derives the bands from the global retention target", () => {
		const result = buildQueueOptions(
			filters({ rModeTargetCount: 10 }),
			settings,
			sp,
		);

		expect(result.rMode?.comfortFloor).toBe(0.9);
		expect(result.rMode?.ceiling).toBeCloseTo(0.95, 6);
		expect(result.rMode?.urgentBelow).toBe(0.5);
		expect(result.rMode?.comfortMix).toBe(0.3);
	});

	it("prefers the preset's retention target over the global one", () => {
		const result = buildQueueOptions(
			filters({ rModeTargetCount: 10 }),
			settings,
			sp,
			makePreset({ requestRetention: 0.8 }),
		);

		expect(result.rMode?.comfortFloor).toBe(0.8);
		expect(result.rMode?.ceiling).toBeCloseTo(0.85, 6);
	});

	it("keeps the ceiling below certainty at extreme retention targets", () => {
		const result = buildQueueOptions(
			filters({ rModeTargetCount: 10 }),
			makeSettings({ rMode: { ...R_MODE_ON, ceilingOffset: 0.09 } }),
			sp,
			makePreset({ requestRetention: 0.99 }),
		);

		expect(result.rMode?.ceiling).toBeLessThan(1);
	});

	it("leaves every other queue option untouched", () => {
		const withMode = buildQueueOptions(
			filters({ rModeTargetCount: 10 }),
			settings,
			sp,
		);
		const withoutMode = buildQueueOptions(
			filters(),
			makeSettings({ rMode: { ...R_MODE_ON, enabled: false } }),
			sp,
		);

		expect(withMode.newCardsLimit).toBe(withoutMode.newCardsLimit);
		expect(withMode.reviewsLimit).toBe(withoutMode.reviewsLimit);
		expect(withMode.newCardOrder).toBe(withoutMode.newCardOrder);
		expect(withMode.newReviewMix).toBe(withoutMode.newReviewMix);
		expect(withMode.dayStartHour).toBe(withoutMode.dayStartHour);
	});
});
