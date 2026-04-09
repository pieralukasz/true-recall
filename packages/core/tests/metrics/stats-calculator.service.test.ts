import { State } from "ts-fsrs";

import { StatsCalculatorService } from "../../src/metrics/stats/stats-calculator.service";
import {
	EMPTY_FILTER,
	type StatsFilterContext,
} from "../../src/metrics/stats/stats-filter.types";
import type {
	ExtendedDailyStats,
	FSRSCardData,
	FSRSFlashcardItem,
} from "../../src/types";

function createCard(
	id: string,
	sourceUid: string,
	overrides: Partial<FSRSCardData> = {},
): FSRSFlashcardItem {
	const fsrs: FSRSCardData = {
		id,
		due: overrides.due ?? "2026-03-10T10:00:00.000Z",
		stability: overrides.stability ?? 10,
		difficulty: overrides.difficulty ?? 5,
		reps: overrides.reps ?? 12,
		lapses: overrides.lapses ?? 1,
		state: overrides.state ?? State.Review,
		lastReview: overrides.lastReview ?? "2026-03-09T10:00:00.000Z",
		scheduledDays: overrides.scheduledDays ?? 10,
		learningStep: overrides.learningStep ?? 0,
		suspended: overrides.suspended ?? false,
		buriedUntil: overrides.buriedUntil,
		createdAt: overrides.createdAt ?? Date.parse("2026-03-01T00:00:00.000Z"),
		sourceUid,
	};

	return {
		id,
		question: `Q-${id}`,
		answer: `A-${id}`,
		fsrs,
		sourceUid,
		sourceNoteName: `Note-${id}`,
		sourceNotePath: `Notes/${id}.md`,
	};
}

function createDailyStats(date: string): ExtendedDailyStats {
	return {
		date,
		reviewsCompleted: 10,
		newCardsStudied: 2,
		totalTimeMs: 120_000,
		again: 1,
		hard: 2,
		good: 5,
		easy: 2,
		newCards: 0,
		learningCards: 0,
		reviewCards: 8,
		reviewedCardIds: [],
	};
}

function createSessionPersistenceMock(
	allStats: Record<string, ExtendedDailyStats>,
	todayStats: ExtendedDailyStats,
) {
	return {
		getAllDailyStatsSummary: vi.fn(() => allStats),
		getStatsInRange: vi.fn((startKey: string, endKey: string) =>
			Object.values(allStats).filter(
				(row) => row.date >= startKey && row.date <= endKey,
			),
		),
		getTodayStats: vi.fn(() => todayStats),
	};
}

function createSqliteStoreMock(rows: ExtendedDailyStats[]) {
	return {
		stats: {
			getDailyStatsFromReviewLog: vi.fn(() => rows),
			getNotePerformance: vi.fn(() => []),
			getNotePerformanceFiltered: vi.fn(() => []),
			getCardsCreatedByDate: vi.fn(() => []),
			getCardsCreatedOnDate: vi.fn(() => []),
			getCardMaturityBreakdown: vi.fn(() => ({
				new: 0,
				learning: 0,
				young: 0,
				mature: 0,
				suspended: 0,
				buried: 0,
			})),
		},
	} as any;
}

describe("StatsCalculatorService performance refactor", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("does not repeatedly fetch full card list when snapshot is provided", async () => {
		const cards: FSRSFlashcardItem[] = [
			createCard("card-a", "uid-a", { due: "2026-03-10T08:00:00.000Z" }),
			createCard("card-b", "uid-b", { due: "2026-03-11T08:00:00.000Z" }),
			createCard("card-c", "uid-c", { state: State.New }),
		];
		const flashcardManager = {
			getAllFSRSCards: vi.fn(() => cards),
		};
		const sessionPersistence = createSessionPersistenceMock(
			{
				"2026-03-09": createDailyStats("2026-03-09"),
				"2026-03-10": createDailyStats("2026-03-10"),
			},
			createDailyStats("2026-03-10"),
		);
		const fsrsService = {
			getRetrievability: vi.fn(() => 0.85),
		};

		const calc = new StatsCalculatorService(
			fsrsService as any,
			flashcardManager as any,
			sessionPersistence as any,
		);

		calc.setCardSnapshot(cards);
		calc.setFilter(EMPTY_FILTER);

		calc.getFutureDueStatsFilled("1m");
		calc.getCollectionHealthSnapshot();
		calc.getCardsDueOnDate("2026-03-10");
		await calc.getCardsCreatedHistoryFilled("1m");
		await calc.getRangeSummary("1m");

		expect(flashcardManager.getAllFSRSCards).not.toHaveBeenCalled();
	});

	it("reuses cached daily stats queries for the same filter and range", async () => {
		const cards: FSRSFlashcardItem[] = [
			createCard("card-a", "uid-a", { due: "2026-03-10T08:00:00.000Z" }),
			createCard("card-b", "uid-b", { due: "2026-03-11T08:00:00.000Z" }),
		];
		const flashcardManager = {
			getAllFSRSCards: vi.fn(() => cards),
		};
		const sessionPersistence = createSessionPersistenceMock(
			{},
			createDailyStats("2026-03-10"),
		);
		const fsrsService = {
			getRetrievability: vi.fn(() => 0.85),
		};
		const sqliteRows = [createDailyStats("2026-03-10")];
		const sqliteStore = createSqliteStoreMock(sqliteRows);

		const calc = new StatsCalculatorService(
			fsrsService as any,
			flashcardManager as any,
			sessionPersistence as any,
		);
		calc.setSqliteStore(sqliteStore);
		calc.setCardSnapshot(cards);
		calc.setFilter({
			archivedSourceUids: new Set(),
			presetNames: new Set(["Default"]),
			presetSourceUids: new Set(["uid-a"]),
		});

		calc.getStreakInfo();
		calc.getRetentionHistory("1m");
		calc.getRatingDistributionHistory("1m");
		calc.getTodaySummary();
		expect(sqliteStore.stats.getDailyStatsFromReviewLog).toHaveBeenCalledTimes(
			1,
		);

		// Range queries now derive from full-history cache (no extra DB call)
		calc.getReviewHistory("1m");
		calc.getRangeSummary("1m");
		expect(sqliteStore.stats.getDailyStatsFromReviewLog).toHaveBeenCalledTimes(
			1,
		);
	});

	it("keeps metric outputs unchanged with and without snapshot for no filter and preset filter", async () => {
		const cards: FSRSFlashcardItem[] = [
			createCard("card-a", "uid-a", { due: "2026-03-10T08:00:00.000Z" }),
			createCard("card-b", "uid-b", { due: "2026-03-11T08:00:00.000Z" }),
			createCard("card-c", "uid-c", { state: State.New }),
		];
		const allStats = {
			"2026-03-09": createDailyStats("2026-03-09"),
			"2026-03-10": createDailyStats("2026-03-10"),
		};
		const todayStats = createDailyStats("2026-03-10");

		const flashcardManagerA = {
			getAllFSRSCards: vi.fn(() => cards),
		};
		const flashcardManagerB = {
			getAllFSRSCards: vi.fn(() => cards),
		};
		const sessionPersistenceA = createSessionPersistenceMock(
			allStats,
			todayStats,
		);
		const sessionPersistenceB = createSessionPersistenceMock(
			allStats,
			todayStats,
		);
		const fsrsService = {
			getRetrievability: vi.fn(() => 0.9),
		};

		const calcWithoutSnapshot = new StatsCalculatorService(
			fsrsService as any,
			flashcardManagerA as any,
			sessionPersistenceA as any,
		);
		const calcWithSnapshot = new StatsCalculatorService(
			fsrsService as any,
			flashcardManagerB as any,
			sessionPersistenceB as any,
		);
		calcWithSnapshot.setCardSnapshot(cards);

		calcWithoutSnapshot.setFilter(EMPTY_FILTER);
		calcWithSnapshot.setFilter(EMPTY_FILTER);

		expect(calcWithSnapshot.getFutureDueStatsFilled("1m")).toEqual(
			calcWithoutSnapshot.getFutureDueStatsFilled("1m"),
		);
		expect(calcWithSnapshot.getCollectionHealthSnapshot()).toEqual(
			calcWithoutSnapshot.getCollectionHealthSnapshot(),
		);
		expect(calcWithSnapshot.getRangeSummary("1m")).toEqual(
			calcWithoutSnapshot.getRangeSummary("1m"),
		);

		const sqliteRows = [createDailyStats("2026-03-10")];
		const sqliteStoreA = createSqliteStoreMock(sqliteRows);
		const sqliteStoreB = createSqliteStoreMock(sqliteRows);
		calcWithoutSnapshot.setSqliteStore(sqliteStoreA);
		calcWithSnapshot.setSqliteStore(sqliteStoreB);

		const presetFilter: StatsFilterContext = {
			archivedSourceUids: new Set(),
			presetNames: new Set(["Default"]),
			presetSourceUids: new Set(["uid-a"]),
		};
		calcWithoutSnapshot.setFilter(presetFilter);
		calcWithSnapshot.setFilter(presetFilter);

		expect(calcWithSnapshot.getTodaySummary()).toEqual(
			calcWithoutSnapshot.getTodaySummary(),
		);
		expect(calcWithSnapshot.getRetentionHistory("1m")).toEqual(
			calcWithoutSnapshot.getRetentionHistory("1m"),
		);
		expect(calcWithSnapshot.getReviewHistory("1m")).toEqual(
			calcWithoutSnapshot.getReviewHistory("1m"),
		);
		expect(calcWithSnapshot.getRangeSummary("1m")).toEqual(
			calcWithoutSnapshot.getRangeSummary("1m"),
		);
	});
});
