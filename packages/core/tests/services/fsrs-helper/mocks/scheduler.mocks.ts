/**
 * Mock factories for FSRS Helper scheduler service tests
 */
import { State } from "ts-fsrs";
import { type Mock, vi } from "vitest";

import type {
	CardDueInfo,
	DueDayCount,
	SchedulerCardData,
	SchedulerCardStore,
	WorkloadDistribution,
} from "../../../../src/metrics/fsrs-tools/scheduler/scheduler.types";
import type { EasyDaysConfig } from "../../../../src/types";

/**
 * Mock implementation of SchedulerCardStore for testing.
 * Each method is a Vitest mock function that can be spied on and configured.
 */
export interface MockSchedulerCardStore extends SchedulerCardStore {
	get: Mock<[cardId: string], SchedulerCardData | undefined>;
	getCards: Mock<[], SchedulerCardData[]>;
	getDueCardsByDateRange: Mock<
		[startDate: string, endDate: string],
		CardDueInfo[]
	>;
	getDueCountsByDateRange: Mock<
		[startDate: string, endDate: string, excludeCardId?: string],
		DueDayCount[]
	>;
	updateCardDue: Mock<[cardId: string, newDue: string], Promise<void>>;
	updateCardScheduling: Mock<
		[cardId: string, data: { due: string; scheduledDays: number }],
		Promise<void>
	>;
}

/**
 * Create a mock SchedulerCardStore for scheduler tests.
 * Returns a properly typed mock that satisfies the SchedulerCardStore interface.
 *
 * getDueCountsByDateRange derives its counts from whatever
 * getDueCardsByDateRange returns, mirroring the production SQL semantics
 * (Review cards only, range-filtered by UTC due day, optional exclusion).
 * Tests that stub getDueCardsByDateRange get matching counts for free.
 */
export function createMockCardStore(
	cards: CardDueInfo[] = [],
): MockSchedulerCardStore {
	const getDueCardsByDateRange = vi
		.fn<[string, string], CardDueInfo[]>()
		.mockReturnValue(cards);

	const getDueCountsByDateRange = vi
		.fn<[string, string, string?], DueDayCount[]>()
		.mockImplementation(
			(startDate: string, endDate: string, excludeCardId?: string) => {
				const counts = new Map<string, number>();
				for (const card of getDueCardsByDateRange(startDate, endDate)) {
					if (card.state === State.New) continue;
					if (card.id === excludeCardId) continue;
					const day = card.due.split("T")[0] ?? "";
					if (day < startDate || day > endDate) continue;
					counts.set(day, (counts.get(day) ?? 0) + 1);
				}
				return Array.from(counts.entries())
					.map(([day, count]) => ({ day, count }))
					.sort((a, b) => a.day.localeCompare(b.day));
			},
		);

	return {
		getDueCardsByDateRange,
		getDueCountsByDateRange,
		updateCardDue: vi
			.fn<[string, string], Promise<void>>()
			.mockResolvedValue(undefined),
		updateCardScheduling: vi
			.fn<[string, { due: string; scheduledDays: number }], Promise<void>>()
			.mockResolvedValue(undefined),
		getCards: vi
			.fn<[], SchedulerCardData[]>()
			.mockReturnValue(cards as SchedulerCardData[]),
		get: vi
			.fn<[string], SchedulerCardData | undefined>()
			.mockImplementation(
				(id: string) =>
					cards.find((c) => c.id === id) as SchedulerCardData | undefined,
			),
	};
}

/**
 * Create a single CardDueInfo object
 */
export function createCardDueInfo(
	overrides?: Partial<CardDueInfo>,
): CardDueInfo {
	return {
		id: crypto.randomUUID(),
		due: new Date().toISOString(),
		scheduledDays: 7,
		sourceUid: undefined,
		...overrides,
	};
}

/**
 * Create multiple cards due on a specific date
 */
export function createCardsOnDate(
	date: string,
	count: number,
	sourceUid?: string,
): CardDueInfo[] {
	const cards: CardDueInfo[] = [];
	for (let i = 0; i < count; i++) {
		cards.push(
			createCardDueInfo({
				id: `card-${date}-${i}`,
				due: `${date}T10:00:00.000Z`,
				scheduledDays: 7 + i,
				sourceUid,
			}),
		);
	}
	return cards;
}

/**
 * Create sibling cards (same source) due on different dates
 */
export function createSiblingCards(
	sourceUid: string,
	dates: string[],
): CardDueInfo[] {
	return dates.map((date, i) =>
		createCardDueInfo({
			id: `sibling-${sourceUid}-${i}`,
			due: `${date}T10:00:00.000Z`,
			scheduledDays: 7,
			sourceUid,
		}),
	);
}

/**
 * Create cards spread across a date range
 */
export function createCardsInRange(
	startDate: string,
	endDate: string,
	cardsPerDay: number,
): CardDueInfo[] {
	const cards: CardDueInfo[] = [];
	const start = new Date(startDate);
	const end = new Date(endDate);

	const current = new Date(start);
	while (current <= end) {
		const dateStr = current.toISOString().split("T")[0] ?? "";
		cards.push(...createCardsOnDate(dateStr, cardsPerDay));
		current.setDate(current.getDate() + 1);
	}

	return cards;
}

/**
 * Create an overloaded day scenario
 */
export function createOverloadedScenario(
	normalDays: { date: string; count: number }[],
	overloadedDays: { date: string; count: number }[],
): CardDueInfo[] {
	const cards: CardDueInfo[] = [];

	for (const { date, count } of normalDays) {
		cards.push(...createCardsOnDate(date, count));
	}

	for (const { date, count } of overloadedDays) {
		cards.push(...createCardsOnDate(date, count));
	}

	return cards;
}

/**
 * Create EasyDaysConfig
 */
export function createEasyDaysConfig(
	recurringDays: number[] = [],
	specificDates: string[] = [],
): EasyDaysConfig {
	return {
		recurringDays,
		specificDates,
	};
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
	return date.toISOString().split("T")[0] ?? "";
}

/**
 * Add days to a date and return YYYY-MM-DD string
 */
export function addDays(date: Date, days: number): string {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return formatDate(result);
}

/**
 * Get the day of week for a date (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(dateStr: string): number {
	return new Date(dateStr).getDay();
}

/**
 * Build distribution from cards
 */
export function buildDistribution(cards: CardDueInfo[]): Map<string, number> {
	const distribution = new Map<string, number>();
	for (const card of cards) {
		const dateStr = card.due.split("T")[0] ?? "";
		distribution.set(dateStr, (distribution.get(dateStr) ?? 0) + 1);
	}
	return distribution;
}

/**
 * Convert distribution map to array
 */
export function distributionToArray(
	distribution: Map<string, number>,
): WorkloadDistribution[] {
	return Array.from(distribution.entries())
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));
}
