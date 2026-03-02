import { describe, it, expect, vi } from "vitest";
import { buildQueueOptions } from "../../../src/features/study/ui/review/helpers/session-helpers";
import type { SessionFilters } from "../../../src/features/study/ui/review/review.types";
import type { FSRSPreset, TrueRecallSettings } from "../../../src/shared/types/settings.types";
import type { SessionPersistenceService } from "../../../src/features/core/persistence/session-persistence.service";

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
		...overrides,
	} as TrueRecallSettings;
}

function makePreset(overrides: Partial<FSRSPreset> = {}): FSRSPreset {
	return {
		id: "test-preset",
		name: "Test",
		requestRetention: 0.9,
		maximumInterval: 36500,
		weights: null,
		learningSteps: [1, 10],
		relearningSteps: [10],
		newCardsPerDay: 10,
		reviewsPerDay: 100,
		createdAt: Date.now(),
		lastOptimization: null,
		lastOptimizationReviewCount: null,
		lastOptimizationMetrics: null,
		newCardOrder: "random" as const,
		reviewOrder: "by-retrievability" as const,
		newReviewMix: "show-before-reviews" as const,
		...overrides,
	};
}

function makeSessionPersistence(
	overrides: Partial<Record<string, unknown>> = {},
): SessionPersistenceService {
	const reviewedToday = (overrides.reviewedToday ??
		new Set<string>()) as Set<string>;
	const newStudied = (overrides.newCardsStudiedToday ?? 0) as number;
	const reviewsCompleted =
		(overrides.reviewCardsCompletedToday ?? 0) as number;

	return {
		getReviewedToday: vi.fn(() => reviewedToday),
		getNewCardsStudiedToday: vi.fn(() => newStudied),
		getReviewCardsCompletedToday: vi.fn(() => reviewsCompleted),
	} as unknown as SessionPersistenceService;
}

function makeFilters(
	overrides: Partial<SessionFilters> = {},
): SessionFilters {
	return { ...overrides };
}

describe("buildQueueOptions — no preset (all from settings)", () => {
	const settings = makeSettings();
	const sp = makeSessionPersistence();

	it("uses settings.newCardsPerDay", () => {
		const result = buildQueueOptions(makeFilters(), settings, sp);
		expect(result.newCardsLimit).toBe(20);
	});

	it("uses settings.reviewsPerDay", () => {
		const result = buildQueueOptions(makeFilters(), settings, sp);
		expect(result.reviewsLimit).toBe(200);
	});

	it("uses settings.newCardOrder", () => {
		const result = buildQueueOptions(makeFilters(), settings, sp);
		expect(result.newCardOrder).toBe("oldest-first");
	});

	it("uses settings.reviewOrder", () => {
		const result = buildQueueOptions(makeFilters(), settings, sp);
		expect(result.reviewOrder).toBe("due-date");
	});

	it("uses settings.newReviewMix", () => {
		const result = buildQueueOptions(makeFilters(), settings, sp);
		expect(result.newReviewMix).toBe("mix-with-reviews");
	});

	it("passes settings.dayStartHour", () => {
		const result = buildQueueOptions(makeFilters(), settings, sp);
		expect(result.dayStartHour).toBe(4);
	});
});

describe("buildQueueOptions — preset overrides", () => {
	const settings = makeSettings({
		newCardsPerDay: 20,
		reviewsPerDay: 200,
		newCardOrder: "oldest-first",
		reviewOrder: "due-date",
		newReviewMix: "mix-with-reviews",
	});
	const sp = makeSessionPersistence();

	it("preset.newCardsPerDay overrides settings", () => {
		const preset = makePreset({ newCardsPerDay: 5 });
		const result = buildQueueOptions(makeFilters(), settings, sp, preset);
		expect(result.newCardsLimit).toBe(5);
	});

	it("preset.reviewsPerDay overrides settings", () => {
		const preset = makePreset({ reviewsPerDay: 50 });
		const result = buildQueueOptions(makeFilters(), settings, sp, preset);
		expect(result.reviewsLimit).toBe(50);
	});

	it("preset.newCardOrder overrides settings", () => {
		const preset = makePreset({ newCardOrder: "newest-first" });
		const result = buildQueueOptions(makeFilters(), settings, sp, preset);
		expect(result.newCardOrder).toBe("newest-first");
	});

	it("preset.reviewOrder overrides settings", () => {
		const preset = makePreset({ reviewOrder: "most-lapses" });
		const result = buildQueueOptions(makeFilters(), settings, sp, preset);
		expect(result.reviewOrder).toBe("most-lapses");
	});

	it("preset.newReviewMix overrides settings", () => {
		const preset = makePreset({ newReviewMix: "show-after-reviews" });
		const result = buildQueueOptions(makeFilters(), settings, sp, preset);
		expect(result.newReviewMix).toBe("show-after-reviews");
	});

	it("undefined preset fields fall back to settings", () => {
		const preset = makePreset({
			newCardOrder: undefined,
			reviewOrder: undefined,
			newReviewMix: undefined,
		});
		const result = buildQueueOptions(makeFilters(), settings, sp, preset);
		expect(result.newCardOrder).toBe("oldest-first");
		expect(result.reviewOrder).toBe("due-date");
		expect(result.newReviewMix).toBe("mix-with-reviews");
	});
});

describe("buildQueueOptions — reviewOrder 3-level cascade", () => {
	const settings = makeSettings({ reviewOrder: "due-date" });
	const sp = makeSessionPersistence();
	const preset = makePreset({ reviewOrder: "by-retrievability" });

	it("filters.customReviewOrder wins over preset and settings", () => {
		const filters = makeFilters({ customReviewOrder: "most-lapses" });
		const result = buildQueueOptions(filters, settings, sp, preset);
		expect(result.reviewOrder).toBe("most-lapses");
	});

	it("preset.reviewOrder wins when filters.customReviewOrder is undefined", () => {
		const filters = makeFilters();
		const result = buildQueueOptions(filters, settings, sp, preset);
		expect(result.reviewOrder).toBe("by-retrievability");
	});

	it("settings.reviewOrder used when both filters and preset are undefined", () => {
		const filters = makeFilters();
		const presetNoOrder = makePreset({ reviewOrder: undefined });
		const result = buildQueueOptions(filters, settings, sp, presetNoOrder);
		expect(result.reviewOrder).toBe("due-date");
	});
});

describe("buildQueueOptions — session persistence", () => {
	const settings = makeSettings();

	it("calls getReviewedToday and forwards result", () => {
		const reviewed = new Set(["card-1", "card-2"]);
		const sp = makeSessionPersistence({ reviewedToday: reviewed });
		const result = buildQueueOptions(makeFilters(), settings, sp);
		expect(sp.getReviewedToday).toHaveBeenCalledOnce();
		expect(result.reviewedToday).toBe(reviewed);
	});

	it("calls getNewCardsStudiedToday and forwards result", () => {
		const sp = makeSessionPersistence({ newCardsStudiedToday: 7 });
		const result = buildQueueOptions(makeFilters(), settings, sp);
		expect(sp.getNewCardsStudiedToday).toHaveBeenCalledOnce();
		expect(result.newCardsStudiedToday).toBe(7);
	});

	it("calls getReviewCardsCompletedToday and forwards result", () => {
		const sp = makeSessionPersistence({ reviewCardsCompletedToday: 42 });
		const result = buildQueueOptions(makeFilters(), settings, sp);
		expect(sp.getReviewCardsCompletedToday).toHaveBeenCalledOnce();
		expect(result.reviewsCompletedToday).toBe(42);
	});
});

describe("buildQueueOptions — filter passthrough", () => {
	const settings = makeSettings();
	const sp = makeSessionPersistence();

	it("passes sourceNoteFilter through", () => {
		const filters = makeFilters({ sourceNoteFilter: "uid-123" });
		const result = buildQueueOptions(filters, settings, sp);
		expect(result.sourceNoteFilter).toBe("uid-123");
	});

	it("passes stateFilter through", () => {
		const filters = makeFilters({ stateFilter: "new" });
		const result = buildQueueOptions(filters, settings, sp);
		expect(result.stateFilter).toBe("new");
	});

	it("passes ignoreDailyLimits through", () => {
		const filters = makeFilters({ ignoreDailyLimits: true });
		const result = buildQueueOptions(filters, settings, sp);
		expect(result.ignoreDailyLimits).toBe(true);
	});

	it("passes bypassScheduling through", () => {
		const filters = makeFilters({ bypassScheduling: true });
		const result = buildQueueOptions(filters, settings, sp);
		expect(result.bypassScheduling).toBe(true);
	});

	it("passes weakCardsOnly through", () => {
		const filters = makeFilters({ weakCardsOnly: true });
		const result = buildQueueOptions(filters, settings, sp);
		expect(result.weakCardsOnly).toBe(true);
	});

	it("passes sourceNoteFilters array through", () => {
		const filters = makeFilters({
			sourceNoteFilters: ["uid-1", "uid-2"],
		});
		const result = buildQueueOptions(filters, settings, sp);
		expect(result.sourceNoteFilters).toEqual(["uid-1", "uid-2"]);
	});

	it("passes range filters through", () => {
		const filters = makeFilters({
			difficultyRange: { min: 0.3, max: 0.8 },
			lapsesRange: { min: 1, max: 5 },
			stabilityRange: { min: 2, max: 30 },
		});
		const result = buildQueueOptions(filters, settings, sp);
		expect(result.difficultyRange).toEqual({ min: 0.3, max: 0.8 });
		expect(result.lapsesRange).toEqual({ min: 1, max: 5 });
		expect(result.stabilityRange).toEqual({ min: 2, max: 30 });
	});
});
