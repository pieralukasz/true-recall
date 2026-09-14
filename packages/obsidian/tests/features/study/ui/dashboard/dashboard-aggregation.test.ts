import type { MetadataCache } from "obsidian";
import { State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";
import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type { PresetService } from "@true-recall/core/services/notes/preset.service";
import type { CardSchedulingMeta } from "@true-recall/core/types/fsrs/card.types";
import type { TodaySummary } from "@true-recall/core/types/fsrs/stats.types";
import type {
	FSRSPreset,
	TrueRecallSettings,
} from "@true-recall/core/types/settings.types";

import {
	buildDashboardAggregation,
	createDashboardSnapshotContext,
} from "@true-recall/obsidian/features/study/ui/dashboard/helpers/dashboard-aggregation";

import {
	createDefaultFSRSSettings,
	createMockFlashcard,
} from "../../../../../../core/tests/mocks/fsrs.mocks";

const TODAY_SUMMARY: TodaySummary = {
	studied: 0,
	minutes: 0,
	newCards: 0,
	reviewCards: 0,
	again: 0,
	correctRate: 0,
};

function createPreset(overrides: Partial<FSRSPreset> = {}): FSRSPreset {
	return {
		id: "default",
		name: "Default",
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

interface ServicesFixture {
	ignoreDailyLimitsForNoteStudy: boolean;
	archivedNotePaths?: string[];
}

function createServices(fixture: ServicesFixture) {
	const preset = createPreset();
	const settings: TrueRecallSettings = {
		...DEFAULT_SETTINGS,
		fsrsPresets: [preset],
		defaultPresetId: preset.id,
		rMode: { ...DEFAULT_SETTINGS.rMode, enabled: false },
		ignoreDailyLimitsForNoteStudy: fixture.ignoreDailyLimitsForNoteStudy,
	};
	const archivedNotePaths = new Set(fixture.archivedNotePaths ?? []);

	const sessionPersistence = {
		getReviewedToday: () => new Set<string>(),
		getNewCardsStudiedToday: () => 0,
		getReviewCardsCompletedToday: () => 0,
		getTodayProgressByPreset: () => new Map(),
	} as unknown as SessionPersistenceService;

	const presetService = {
		getPresets: () => settings.fsrsPresets,
		getDefaultPreset: () => preset,
		resolvePresetForCard: () => preset,
		resolvePresetChain: () => ({ effective: { preset } }),
		toFSRSSettings: () => ({}),
	} as unknown as PresetService;

	const hierarchyService = {
		isNoteArchived: (path: string) => archivedNotePaths.has(path),
		isProjectArchived: (path: string) => archivedNotePaths.has(path),
		getSourceUidsForProject: () => new Set<string>(),
	} as unknown as HierarchyService;

	return {
		settings,
		sessionPersistence,
		presetService,
		hierarchyService,
		fsrsService: new FSRSService(createDefaultFSRSSettings()),
		metadataCache: {
			getFirstLinkpathDest: () => null,
		} as unknown as MetadataCache,
	};
}

function createNewCards(
	count: number,
	noteName: string,
	notePath: string,
): CardSchedulingMeta[] {
	return Array.from({ length: count }, (_, index) =>
		createMockFlashcard({
			id: `${noteName}-new-${index}`,
			sourceUid: `uid-${noteName}`,
			sourceNoteName: noteName,
			sourceNotePath: notePath,
			fsrs: { state: State.New },
		}),
	);
}

function createLearningCard(
	id: string,
	noteName: string,
	notePath: string,
	due: Date,
): CardSchedulingMeta {
	return createMockFlashcard({
		id,
		sourceUid: `uid-${noteName}`,
		sourceNoteName: noteName,
		sourceNotePath: notePath,
		fsrs: {
			state: State.Learning,
			due: due.toISOString(),
			stability: 0.4,
			difficulty: 5,
			reps: 1,
		},
	});
}

interface AggregationInput {
	cards: CardSchedulingMeta[];
	services: ReturnType<typeof createServices>;
	showArchived?: boolean;
	now?: Date;
}

function runAggregation(input: AggregationInput) {
	return buildDashboardAggregation({
		allCards: input.cards,
		activeCards: input.cards,
		archivedSourceUids: new Set<string>(),
		showArchived: input.showArchived ?? false,
		now: input.now ?? new Date(),
		streakCurrent: 0,
		todaySummary: TODAY_SUMMARY,
		snapshotContext: createDashboardSnapshotContext(
			input.services.sessionPersistence,
		),
		services: input.services,
	});
}

describe("buildDashboardAggregation", () => {
	it("keeps uncapped note counts when note study ignores daily limits", () => {
		const cards = createNewCards(99, "Nine", "Notes/Nine.md");
		const services = createServices({ ignoreDailyLimitsForNoteStudy: true });

		const aggregation = runAggregation({ cards, services });

		const note = aggregation.notes.find((entry) => entry.name === "Nine");
		expect(note?.newCount).toBe(99);
		expect(aggregation.totalNew).toBe(20);
	});

	it("caps note counts at the preset limit when daily limits apply", () => {
		const cards = createNewCards(99, "Nine", "Notes/Nine.md");
		const services = createServices({ ignoreDailyLimitsForNoteStudy: false });

		const aggregation = runAggregation({ cards, services });

		const note = aggregation.notes.find((entry) => entry.name === "Nine");
		expect(note?.newCount).toBe(20);
		expect(aggregation.totalNew).toBe(20);
	});

	it("separates learning cards due now from pending learning steps", () => {
		const now = new Date();
		const cards = [
			createLearningCard(
				"pending-1",
				"Pending",
				"Notes/Pending.md",
				new Date(now.getTime() + 60 * 60 * 1000),
			),
			createLearningCard(
				"active-1",
				"Active",
				"Notes/Active.md",
				new Date(now.getTime() - 60 * 60 * 1000),
			),
		];
		const services = createServices({ ignoreDailyLimitsForNoteStudy: true });

		const aggregation = runAggregation({ cards, services, now });

		const pending = aggregation.notes.find((entry) => entry.name === "Pending");
		const active = aggregation.notes.find((entry) => entry.name === "Active");
		expect(pending?.learningPending).toBe(1);
		expect(pending?.learning).toBe(0);
		expect(active?.learning).toBe(1);
		expect(active?.learningPending).toBe(0);
	});

	it("keeps raw counts for archived notes when archived notes are shown", () => {
		const cards = createNewCards(99, "Archived", "Notes/Archived.md");
		const services = createServices({
			ignoreDailyLimitsForNoteStudy: false,
			archivedNotePaths: ["Notes/Archived.md"],
		});

		const aggregation = runAggregation({
			cards,
			services,
			showArchived: true,
		});

		const note = aggregation.notes.find((entry) => entry.name === "Archived");
		expect(note?.newCount).toBe(99);
	});
});
