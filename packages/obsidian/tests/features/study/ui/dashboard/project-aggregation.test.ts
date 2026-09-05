import type { MetadataCache } from "obsidian";
import { State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, UNASSIGNED_PATH } from "@true-recall/core/constants";
import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type {
	HierarchyService,
	HierarchyTreeNode,
} from "@true-recall/core/services/notes/hierarchy.service";
import type { PresetService } from "@true-recall/core/services/notes/preset.service";
import type { ActionableSessionSnapshot } from "@true-recall/core/services/review/actionable-session-snapshot.service";
import { captureSessionProgress } from "@true-recall/core/services/review/session-helpers";
import type { DashboardNoteEntry } from "@true-recall/core/types/dashboard.types";
import type { CardSchedulingMeta } from "@true-recall/core/types/fsrs/card.types";
import type {
	FSRSPreset,
	TrueRecallSettings,
} from "@true-recall/core/types/settings.types";

import { aggregateProjectData } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/project-aggregation";

import {
	createDefaultFSRSSettings,
	createMockFlashcard,
} from "../../../../../../core/tests/mocks/fsrs.mocks";

const NOW = new Date("2026-03-01T10:00:00.000Z");
const PAST_DUE = "2024-01-01T00:00:00.000Z";

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

function createSettings(preset: FSRSPreset): TrueRecallSettings {
	return {
		...DEFAULT_SETTINGS,
		fsrsPresets: [preset],
		defaultPresetId: preset.id,
		rMode: { ...DEFAULT_SETTINGS.rMode, enabled: false },
	};
}

function createNoteEntry(
	overrides: Partial<DashboardNoteEntry> & { name: string },
): DashboardNoteEntry {
	return {
		path: null,
		due: 0,
		newCount: 0,
		learning: 0,
		total: 0,
		lastReview: null,
		overdueDays: 0,
		overdueCount: 0,
		estimatedMinutes: 0,
		priority: "done",
		projects: [],
		...overrides,
	};
}

interface CardBatch {
	count: number;
	idPrefix: string;
	sourceUid: string;
	sourceNoteName: string;
	sourceNotePath?: string;
	state: State;
	due?: string;
}

function createCards(batch: CardBatch): CardSchedulingMeta[] {
	return Array.from({ length: batch.count }, (_, index) =>
		createMockFlashcard({
			id: `${batch.idPrefix}-${index}`,
			sourceUid: batch.sourceUid,
			sourceNoteName: batch.sourceNoteName,
			sourceNotePath: batch.sourceNotePath,
			fsrs: {
				state: batch.state,
				due: batch.due ?? PAST_DUE,
				stability: batch.state === State.New ? 0 : 10,
				difficulty: batch.state === State.New ? 0 : 5,
			},
		}),
	);
}

interface ServicesFixture {
	cards: CardSchedulingMeta[];
	hierarchy: HierarchyTreeNode[];
	sourceUidsByProject?: Record<string, string[]>;
	archivedProjects?: string[];
	preset?: FSRSPreset;
}

function createServices(fixture: ServicesFixture) {
	const preset = fixture.preset ?? createPreset();
	const settings = createSettings(preset);
	const archivedProjects = new Set(fixture.archivedProjects ?? []);
	const sourceUidsByProject = new Map<string, Set<string>>(
		Object.entries(fixture.sourceUidsByProject ?? {}).map(([path, uids]) => [
			path,
			new Set(uids),
		]),
	);

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
		buildHierarchy: () => fixture.hierarchy,
		getSourceUidsForProject: (path: string) =>
			sourceUidsByProject.get(path) ?? new Set<string>(),
		isProjectArchived: (path: string) => archivedProjects.has(path),
		isNoteArchived: (path: string) => archivedProjects.has(path),
	} as unknown as HierarchyService;

	return {
		hierarchyService,
		cardStore: {},
		fsrsService: new FSRSService(createDefaultFSRSSettings()),
		presetService,
		sessionPersistence,
		settings,
		allCards: fixture.cards,
		archivedSourceUids: new Set<string>(),
		activeCards: fixture.cards,
		metadataCache: {
			getFirstLinkpathDest: () => null,
		} as unknown as MetadataCache,
	};
}

describe("aggregateProjectData", () => {
	it("caps a project's new cards at the effective preset limit", () => {
		const cards = [
			...createCards({
				count: 25,
				idPrefix: "new",
				sourceUid: "uid-a",
				sourceNoteName: "Alpha",
				sourceNotePath: "Notes/Alpha.md",
				state: State.New,
			}),
			...createCards({
				count: 3,
				idPrefix: "due",
				sourceUid: "uid-a",
				sourceNoteName: "Alpha",
				sourceNotePath: "Notes/Alpha.md",
				state: State.Review,
			}),
			...createCards({
				count: 1,
				idPrefix: "learning",
				sourceUid: "uid-a",
				sourceNoteName: "Alpha",
				sourceNotePath: "Notes/Alpha.md",
				state: State.Learning,
			}),
		];
		const services = createServices({
			cards,
			hierarchy: [
				{
					path: "Projects/Alpha.md",
					name: "Alpha project",
					treePath: "Projects/Alpha.md",
					children: [],
					memberPaths: ["Notes/Alpha.md"],
				},
			],
			sourceUidsByProject: { "Projects/Alpha.md": ["uid-a"] },
		});

		const result = aggregateProjectData({
			notes: [
				createNoteEntry({
					name: "Alpha",
					path: "Notes/Alpha.md",
					newCount: 25,
					due: 3,
					learning: 1,
					total: 29,
				}),
			],
			now: NOW,
			services,
		});

		const project = result.projects.find(
			(candidate) => candidate.path === "Projects/Alpha.md",
		);
		expect(project?.newCount).toBe(20);
		expect(project?.due).toBe(3);
		expect(project?.learning).toBe(1);
	});

	it("caps the virtual Unassigned project with the default preset limit", () => {
		const cards = [
			...createCards({
				count: 60,
				idPrefix: "u1-new",
				sourceUid: "uid-u1",
				sourceNoteName: "Unassigned one",
				sourceNotePath: "Notes/One.md",
				state: State.New,
			}),
			...createCards({
				count: 50,
				idPrefix: "u2-new",
				sourceUid: "uid-u2",
				sourceNoteName: "Unassigned two",
				sourceNotePath: "Notes/Two.md",
				state: State.New,
			}),
			...createCards({
				count: 4,
				idPrefix: "u1-due",
				sourceUid: "uid-u1",
				sourceNoteName: "Unassigned one",
				sourceNotePath: "Notes/One.md",
				state: State.Review,
			}),
		];
		const services = createServices({ cards, hierarchy: [] });

		const result = aggregateProjectData({
			notes: [
				createNoteEntry({
					name: "Unassigned one",
					path: "Notes/One.md",
					newCount: 60,
					due: 4,
					total: 64,
				}),
				createNoteEntry({
					name: "Unassigned two",
					path: "Notes/Two.md",
					newCount: 50,
					total: 50,
				}),
			],
			now: NOW,
			services,
		});

		const unassigned = result.projects.find(
			(candidate) => candidate.path === UNASSIGNED_PATH,
		);
		expect(unassigned?.memberNotes).toHaveLength(2);
		expect(unassigned?.newCount).toBe(20);
		expect(unassigned?.due).toBe(4);
	});

	it("uses raw uncapped counts for an archived project", () => {
		const cards = createCards({
			count: 25,
			idPrefix: "archived-new",
			sourceUid: "uid-arch",
			sourceNoteName: "Archived note",
			sourceNotePath: "Notes/Archived.md",
			state: State.New,
		});
		const fixture: ServicesFixture = {
			cards,
			hierarchy: [
				{
					path: "Projects/Archived.md",
					name: "Archived project",
					treePath: "Projects/Archived.md",
					children: [],
					memberPaths: ["Notes/Archived.md"],
				},
			],
			sourceUidsByProject: { "Projects/Archived.md": ["uid-arch"] },
			archivedProjects: ["Projects/Archived.md"],
		};
		const notes = [
			createNoteEntry({
				name: "Archived note",
				path: "Notes/Archived.md",
				newCount: 25,
				total: 25,
			}),
		];

		const shown = aggregateProjectData({
			notes,
			showArchived: true,
			now: NOW,
			services: createServices(fixture),
		});
		const hidden = aggregateProjectData({
			notes,
			showArchived: false,
			now: NOW,
			services: createServices(fixture),
		});

		const archivedProject = shown.projects.find(
			(candidate) => candidate.path === "Projects/Archived.md",
		);
		expect(archivedProject?.newCount).toBe(25);
		expect(archivedProject?.archived).toBe(true);
		expect(
			hidden.projects.find(
				(candidate) => candidate.path === "Projects/Archived.md",
			),
		).toBeUndefined();
	});

	it("populates the shared snapshot cache when one is supplied", () => {
		const cards = createCards({
			count: 5,
			idPrefix: "shared-new",
			sourceUid: "uid-shared",
			sourceNoteName: "Shared",
			sourceNotePath: "Notes/Shared.md",
			state: State.New,
		});
		const services = createServices({
			cards,
			hierarchy: [
				{
					path: "Projects/Shared.md",
					name: "Shared project",
					treePath: "Projects/Shared.md",
					children: [],
					memberPaths: ["Notes/Shared.md"],
				},
			],
			sourceUidsByProject: { "Projects/Shared.md": ["uid-shared"] },
		});
		const snapshotContext = {
			cache: new Map<string, ActionableSessionSnapshot>(),
			sessionProgress: captureSessionProgress(services.sessionPersistence),
		};

		aggregateProjectData({
			notes: [
				createNoteEntry({
					name: "Shared",
					path: "Notes/Shared.md",
					newCount: 5,
					total: 5,
				}),
			],
			now: NOW,
			snapshotContext,
			services,
		});

		expect(snapshotContext.cache.size).toBeGreaterThan(0);
	});
});
