import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../../../src/constants";
import { SessionService } from "../../../src/services/review/session.service";
import type {
	CardSchedulingMeta,
	FSRSPreset,
	TrueRecallSettings,
} from "../../../src/types";
import { createMockCard } from "../../mocks/fsrs.mocks";

function createCard(
	overrides: Partial<CardSchedulingMeta> & {
		fsrs?: Partial<CardSchedulingMeta["fsrs"]>;
	} = {},
): CardSchedulingMeta {
	const fsrs = createMockCard({
		id: overrides.id,
		state: overrides.fsrs?.state,
		due: overrides.fsrs?.due,
		createdAt: overrides.fsrs?.createdAt,
		stability: overrides.fsrs?.stability,
		difficulty: overrides.fsrs?.difficulty,
		scheduledDays: overrides.fsrs?.scheduledDays,
	});

	return {
		id: overrides.id ?? fsrs.id,
		fsrs,
		sourceUid: overrides.sourceUid,
		sourceNoteName: overrides.sourceNoteName,
		sourceNotePath: overrides.sourceNotePath,
		cardType: overrides.cardType,
		noteId: overrides.noteId,
		templateOrd: overrides.templateOrd,
		noteTypeName: overrides.noteTypeName,
		alwaysTypeIn: overrides.alwaysTypeIn,
	};
}

function createPreset(name = "Default"): FSRSPreset {
	return {
		...DEFAULT_SETTINGS.fsrsPresets[0],
		name,
	};
}

function createDeps(
	allCards: CardSchedulingMeta[],
	settings: TrueRecallSettings = DEFAULT_SETTINGS,
) {
	const defaultPreset = createPreset();
	return {
		allCards,
		archivedSourceUids: new Set<string>(),
		settings,
		sessionPersistence: {
			getReviewedToday: () => new Set<string>(),
			getNewCardsStudiedToday: () => 0,
			getReviewCardsCompletedToday: () => 0,
			getTodayProgressByPreset: () => new Map(),
		},
		presetService: {
			getDefaultPreset: () => defaultPreset,
			resolvePresetChain: () => ({
				effective: { preset: defaultPreset },
			}),
		},
	};
}

describe("SessionService", () => {
	let service: SessionService;

	beforeEach(() => {
		service = new SessionService();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("accepts note review when a review card is due later in the same FSRS day", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-01-15T10:00:00"));

		const noteCard = createCard({
			id: "note-card",
			sourceUid: "note-1",
			sourceNoteName: "My note",
			fsrs: {
				state: State.Review,
				due: "2024-01-15T23:00:00.000",
				stability: 7,
				difficulty: 5,
				scheduledDays: 7,
			},
		});

		const result = service.validate(
			{ mode: "note", sourceUid: "note-1" },
			createDeps([noteCard]),
			{
				ignoreDailyLimitsForNoteStudy: true,
				dayStartHour: 4,
			},
		);

		expect(result.valid).toBe(true);
	});

	it("uses dayStartHour for created_today sessions instead of midnight", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-01-15T01:30:00"));

		const cardCreatedBeforeMidnight = createCard({
			id: "created-today-card",
			fsrs: {
				state: State.New,
				createdAt: new Date("2024-01-14T23:30:00").getTime(),
			},
		});

		const result = service.validate(
			{ mode: "created_today" },
			createDeps([cardCreatedBeforeMidnight]),
			{
				ignoreDailyLimitsForNoteStudy: true,
				dayStartHour: 4,
			},
		);

		expect(result.valid).toBe(true);
	});

	it.each([
		["forgotten", { kind: "forgotten", days: 1 } as const],
		["preview-new", { kind: "preview-new", days: 2 } as const],
		[
			"all cards",
			{
				kind: "state-or-tag",
				cardState: "all",
				cardLimit: 100,
				tagsToInclude: [],
				tagsToExclude: [],
			} as const,
		],
	])("marks %s custom study as a non-rescheduling preview", (_, customStudy) => {
		const filters = service.resolveFilters(
			{ mode: "custom", customStudy },
			{ ignoreDailyLimitsForNoteStudy: false, dayStartHour: 4 },
		);

		expect(filters.ignoreDailyLimits).toBe(true);
		expect(filters.bypassScheduling).toBe(true);
		expect(filters.crammingMode).toBe(true);
	});

	it.each([
		["review-ahead", { kind: "review-ahead", days: 3 } as const],
		["actual-learning", { kind: "actual-learning" } as const],
	])("keeps %s custom study rescheduling enabled", (_, customStudy) => {
		const filters = service.resolveFilters(
			{ mode: "custom", customStudy },
			{ ignoreDailyLimitsForNoteStudy: false, dayStartHour: 4 },
		);

		expect(filters.crammingMode).toBe(false);
	});
});
