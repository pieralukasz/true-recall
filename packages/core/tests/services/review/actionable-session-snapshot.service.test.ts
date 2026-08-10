import { State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../../../src/constants";
import type { SessionPersistenceService } from "../../../src/persistence/session/session-persistence.service";
import type { HierarchyService } from "../../../src/services/notes/hierarchy.service";
import type { PresetService } from "../../../src/services/notes/preset.service";
import {
	type ActionableSessionSnapshotDeps,
	computeActionableSessionSnapshot,
} from "../../../src/services/review/actionable-session-snapshot.service";
import type { RModeCardOptions } from "../../../src/services/review/retrievability-queue";
import type {
	FSRSPreset,
	TrueRecallSettings,
} from "../../../src/types/settings.types";
import { createMockFlashcard } from "../../mocks/fsrs.mocks";

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

function createSettings(
	presets: FSRSPreset[],
	defaultPresetId: string,
): TrueRecallSettings {
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
		toFSRSSettings: () => ({}),
	} as unknown as PresetService;
	const sessionPersistence = {
		getReviewedToday: () => new Set<string>(),
		getNewCardsStudiedToday: () => 0,
		getReviewCardsCompletedToday: () => 0,
		getTodayProgressByPreset: () =>
			new Map<string, { newStudied: number; reviewsCompleted: number }>(),
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
		const settings = createSettings(
			[defaultPreset, proPreset],
			defaultPreset.id,
		);

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

	it("scoped snapshot uses per-preset progress, not the global counter", () => {
		const codingPreset = createPreset("Coding", { newCardsPerDay: 20 });
		const defaultPreset = createPreset("Default", { newCardsPerDay: 9999 });
		const settings = createSettings(
			[defaultPreset, codingPreset],
			defaultPreset.id,
		);

		const cards = [
			createMockFlashcard({
				id: "coding-new-1",
				sourceUid: "coding-uid",
				fsrs: { state: State.New, due: "2024-01-01T00:00:00.000Z" },
			}),
		];

		const presetService = {
			getPresets: () => settings.fsrsPresets,
			getDefaultPreset: () => defaultPreset,
			resolvePresetForCard: () => codingPreset,
			resolvePresetChain: () => ({ effective: { preset: codingPreset } }),
		} as unknown as PresetService;

		// Mirrors the user-reported scenario: 12 new studied today against
		// the Coding preset's 20-card budget; the global counter is 20 because
		// other presets contributed too. Pre-fix the per-project queue would
		// see 20 - 20 = 0 and drop this card; post-fix it sees 12 → 8 left.
		const sessionPersistence = {
			getReviewedToday: () => new Set<string>(),
			getNewCardsStudiedToday: () => 20,
			getReviewCardsCompletedToday: () => 50,
			getTodayProgressByPreset: () =>
				new Map([
					["Coding", { newStudied: 12, reviewsCompleted: 0 }],
					["Default", { newStudied: 8, reviewsCompleted: 50 }],
				]),
		} as unknown as SessionPersistenceService;

		const hierarchyService = {
			getSourceUidsForProject: () => new Set(["coding-uid"]),
		} as unknown as HierarchyService;

		const snapshot = computeActionableSessionSnapshot(
			createDeps({
				allCards: cards,
				settings,
				presetService,
				sessionPersistence,
				hierarchyService,
			}),
			{ projectPath: "Projects/Coding.md" },
		);

		expect(snapshot.counts.new).toBe(1);
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
		} as unknown as import("../../../src/services/fsrs/fsrs.service").FSRSService;

		const reviewService = {
			buildQueue: vi.fn(() => cards),
		} as unknown as import("../../../src/services/review/review.service").ReviewService;

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

	it("keeps target count and scheduling mode in the snapshot cache key", () => {
		const cache = new Map();
		const buildQueue = vi.fn(() => []);
		const reviewService = {
			buildQueue,
		} as unknown as import("../../../src/services/review/review.service").ReviewService;
		const deps = createDeps({ reviewService });

		computeActionableSessionSnapshot(
			deps,
			{ rModeTargetCount: 10, schedulingMode: "due" },
			{ cache },
		);
		computeActionableSessionSnapshot(
			deps,
			{ rModeTargetCount: 20, schedulingMode: "due" },
			{ cache },
		);
		computeActionableSessionSnapshot(
			deps,
			{ rModeTargetCount: 20, schedulingMode: "retrievability" },
			{ cache },
		);

		expect(buildQueue).toHaveBeenCalledTimes(3);
	});

	it("counts only learning steps due now as actionable", () => {
		const cards = [
			createMockFlashcard({
				id: "learning-now",
				fsrs: {
					state: State.Learning,
					due: new Date(Date.now() - 60_000).toISOString(),
				},
			}),
			createMockFlashcard({
				id: "learning-later",
				fsrs: {
					state: State.Relearning,
					due: new Date(Date.now() + 60_000).toISOString(),
				},
			}),
		];
		const reviewService = {
			buildQueue: vi.fn(() => cards),
		} as unknown as import("../../../src/services/review/review.service").ReviewService;

		const snapshot = computeActionableSessionSnapshot(
			createDeps({ allCards: cards, reviewService }),
			{},
		);

		expect(snapshot.counts.learning).toBe(1);
		expect(snapshot.counts.learningPending).toBe(1);
	});

	it("resolves R-Mode thresholds and FSRS settings per card preset", () => {
		const defaultPreset = createPreset("Default", { requestRetention: 0.85 });
		const strictPreset = createPreset("Strict", { requestRetention: 0.95 });
		const settings = {
			...createSettings([defaultPreset, strictPreset], defaultPreset.id),
			rMode: { ...DEFAULT_SETTINGS.rMode, enabled: true, ceilingOffset: 0.03 },
		};
		const card = createMockFlashcard({
			id: "strict-card",
			sourceUid: "strict-source",
			fsrs: { state: State.Review },
		});
		const strictSettings = { requestRetention: 0.95 };
		const toFSRSSettings = vi.fn((preset: FSRSPreset) =>
			preset === strictPreset ? strictSettings : {},
		);
		const presetService = {
			getPresets: () => settings.fsrsPresets,
			getDefaultPreset: () => defaultPreset,
			resolvePresetForCard: () => strictPreset,
			resolvePresetChain: () => ({ effective: { preset: defaultPreset } }),
			toFSRSSettings,
		} as unknown as PresetService;
		let resolved: RModeCardOptions | undefined;
		const reviewService = {
			buildQueue: vi.fn((cards, _fsrs, options) => {
				resolved = options.rMode?.resolveCardOptions?.(cards[0]);
				return [];
			}),
		} as unknown as import("../../../src/services/review/review.service").ReviewService;

		computeActionableSessionSnapshot(
			createDeps({
				allCards: [card],
				settings,
				presetService,
				reviewService,
			}),
			{ schedulingMode: "retrievability" },
		);

		expect(resolved).toEqual({
			comfortFloor: 0.95,
			ceiling: 0.98,
			presetSettings: strictSettings,
		});
		expect(toFSRSSettings).toHaveBeenCalledWith(strictPreset);
	});
});
