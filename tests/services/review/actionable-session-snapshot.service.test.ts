import { describe, expect, it, vi } from "vitest";
import { State } from "ts-fsrs";
import { DEFAULT_SETTINGS } from "../../../src/shared/constants";
import {
	computeActionableSessionSnapshot,
	type ActionableSessionSnapshotDeps,
} from "../../../src/features/study/services/actionable-session-snapshot.service";
import type { SessionPersistenceService } from "../../../src/features/core/persistence/session-persistence.service";
import type { HierarchyService } from "../../../src/features/core/services/hierarchy.service";
import type { PresetService } from "../../../src/features/core/services/preset.service";
import type { FSRSPreset, TrueRecallSettings } from "../../../src/shared/types/settings.types";
import { createMockFlashcard } from "../mocks/fsrs.mocks";

function createPreset(
	name: string,
	overrides: Partial<FSRSPreset> = {},
): FSRSPreset {
	return {
		id: name.toLowerCase(),
		name,
		requestRetention: 0.9,
		maximumInterval: 36500,
		weights: null,
		learningSteps: [1, 10],
		relearningSteps: [10],
		newCardsPerDay: 20,
		reviewsPerDay: 200,
		createdAt: Date.now(),
		lastOptimization: null,
		lastOptimizationReviewCount: null,
		lastOptimizationMetrics: null,
		newCardOrder: "random",
		reviewOrder: "due-date",
		newReviewMix: "mix-with-reviews",
		...overrides,
	};
}

function createSettings(presets: FSRSPreset[], defaultPresetId: string): TrueRecallSettings {
	return {
		...DEFAULT_SETTINGS,
		fsrsPresets: presets,
		defaultPresetId,
	};
}

function createDeps(
	overrides: Partial<ActionableSessionSnapshotDeps>,
): ActionableSessionSnapshotDeps {
	const defaultPreset = createPreset("Default");
	const settings = createSettings([defaultPreset], defaultPreset.id);
	const presetService = {
		getPresets: () => settings.fsrsPresets,
		getDefaultPreset: () => defaultPreset,
		resolvePresetForCard: () => defaultPreset,
		resolvePresetChain: () => ({ effective: { preset: defaultPreset } }),
	} as unknown as PresetService;
	const sessionPersistence = {
		getReviewedToday: () => new Set<string>(),
		getNewCardsStudiedToday: () => 0,
		getReviewCardsCompletedToday: () => 0,
		getTodayProgressByPreset: () => new Map<string, { newStudied: number; reviewsCompleted: number }>(),
	} as unknown as SessionPersistenceService;
	const hierarchyService = {
		getSourceUidsForProject: () => new Set<string>(),
	} as unknown as HierarchyService;

	return {
		allCards: [],
		archivedSourceUids: new Set<string>(),
		settings,
		sessionPersistence,
		presetService,
		hierarchyService,
		...overrides,
	};
}

describe("computeActionableSessionSnapshot", () => {
	it("applies per-preset limits in global mode", () => {
		const defaultPreset = createPreset("Default", { reviewsPerDay: 1 });
		const proPreset = createPreset("Pro", { reviewsPerDay: 10 });
		const settings = createSettings([defaultPreset, proPreset], defaultPreset.id);

		const cards = [
			createMockFlashcard({
				id: "d1",
				sourceUid: "default-1",
				fsrs: { state: State.Review, due: "2024-01-01T00:00:00.000Z" },
			}),
			createMockFlashcard({
				id: "d2",
				sourceUid: "default-2",
				fsrs: { state: State.Review, due: "2024-01-01T00:00:00.000Z" },
			}),
			createMockFlashcard({
				id: "p1",
				sourceUid: "pro-1",
				fsrs: { state: State.Review, due: "2024-01-01T00:00:00.000Z" },
			}),
		];

		const snapshot = computeActionableSessionSnapshot(
			createDeps({
				allCards: cards,
				settings,
				presetService: {
					getPresets: () => settings.fsrsPresets,
					getDefaultPreset: () => defaultPreset,
					resolvePresetForCard: (card) =>
						card.sourceUid?.startsWith("pro") ? proPreset : defaultPreset,
					resolvePresetChain: () => ({ effective: { preset: defaultPreset } }),
				} as unknown as PresetService,
			}),
			{},
		);

		expect(snapshot.counts.due).toBe(2);
		expect(snapshot.queueLength).toBe(2);
	});

	it("excludes reviewedToday cards (non-learning)", () => {
		const cards = [
			createMockFlashcard({
				id: "r1",
				sourceUid: "uid-1",
				fsrs: { state: State.Review, due: "2024-01-01T00:00:00.000Z" },
			}),
			createMockFlashcard({
				id: "r2",
				sourceUid: "uid-2",
				fsrs: { state: State.Review, due: "2024-01-01T00:00:00.000Z" },
			}),
		];

		const snapshot = computeActionableSessionSnapshot(
			createDeps({
				allCards: cards,
				sessionPersistence: {
					getReviewedToday: () => new Set(["r2"]),
					getNewCardsStudiedToday: () => 0,
					getReviewCardsCompletedToday: () => 0,
					getTodayProgressByPreset: () => new Map(),
				} as unknown as SessionPersistenceService,
			}),
			{},
		);

		expect(snapshot.counts.due).toBe(1);
		expect(snapshot.queue.map((c) => c.id)).toEqual(["r1"]);
	});

	it("applies project scope via sourceUidFilter", () => {
		const cards = [
			createMockFlashcard({
				id: "in-project",
				sourceUid: "uid-in",
				fsrs: { state: State.Review, due: "2024-01-01T00:00:00.000Z" },
			}),
			createMockFlashcard({
				id: "out-project",
				sourceUid: "uid-out",
				fsrs: { state: State.Review, due: "2024-01-01T00:00:00.000Z" },
			}),
		];

		const snapshot = computeActionableSessionSnapshot(
			createDeps({
				allCards: cards,
				hierarchyService: {
					getSourceUidsForProject: () => new Set(["uid-in"]),
				} as unknown as HierarchyService,
			}),
			{ projectPath: "Projects/Test.md" },
		);

		expect(snapshot.queueLength).toBe(1);
		expect(snapshot.queue[0]?.id).toBe("in-project");
	});

	it("intersects explicit sourceUidFilter with project scope", () => {
		const cards = [
			createMockFlashcard({
				id: "in-project",
				sourceUid: "uid-in",
				fsrs: { state: State.Review, due: "2024-01-01T00:00:00.000Z" },
			}),
			createMockFlashcard({
				id: "out-project",
				sourceUid: "uid-out",
				fsrs: { state: State.Review, due: "2024-01-01T00:00:00.000Z" },
			}),
		];

		const snapshot = computeActionableSessionSnapshot(
			createDeps({
				allCards: cards,
				hierarchyService: {
					getSourceUidsForProject: () => new Set(["uid-in"]),
				} as unknown as HierarchyService,
			}),
			{
				projectPath: "Projects/Test.md",
				sourceUidFilter: "uid-out",
			},
		);

		expect(snapshot.queueLength).toBe(0);
	});

	it("reuses provided fsrsService without forcing updateSettings", () => {
		const cards = [
			createMockFlashcard({
				id: "due-1",
				sourceUid: "uid-1",
				fsrs: { state: State.Review, due: "2024-01-01T00:00:00.000Z" },
			}),
		];

		const updateSettings = vi.fn();
		const reusableFsrsService = {
			updateSettings,
		} as unknown as import("../../../src/features/core/services/fsrs.service").FSRSService;

		const reviewService = {
			buildQueue: vi.fn(() => cards),
		} as unknown as import("../../../src/features/study/services/review.service").ReviewService;

		const snapshot = computeActionableSessionSnapshot(
			createDeps({
				allCards: cards,
				fsrsService: reusableFsrsService,
				reviewService,
			}),
			{},
		);

		expect(reviewService.buildQueue).toHaveBeenCalled();
		expect(updateSettings).not.toHaveBeenCalled();
		expect(snapshot.queueLength).toBe(1);
	});
});
