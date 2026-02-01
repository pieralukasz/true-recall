/**
 * Mock factories for FSRS Helper scheduler service tests
 */
import { vi } from "vitest";
import type { CardDueInfo, WorkloadDistribution } from "../../../../src/services/fsrs-helper/scheduler/scheduler.types";
import type { EasyDaysConfig } from "../../../../src/types";

/**
 * Create a mock SqliteStoreService for scheduler tests
 */
export function createMockCardStore(cards: CardDueInfo[] = []) {
	return {
		getDueCardsByDateRange: vi.fn().mockReturnValue(cards),
		updateCardDue: vi.fn().mockResolvedValue(undefined),
		updateCardScheduling: vi.fn().mockResolvedValue(undefined),
		getCards: vi.fn().mockReturnValue(cards),
		get: vi.fn((id: string) => cards.find((c) => c.id === id)),
		getReviewDataForOptimization: vi.fn().mockReturnValue([]),
	};
}

/**
 * Create a single CardDueInfo object
 */
export function createCardDueInfo(overrides?: Partial<CardDueInfo>): CardDueInfo {
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
	sourceUid?: string
): CardDueInfo[] {
	const cards: CardDueInfo[] = [];
	for (let i = 0; i < count; i++) {
		cards.push(
			createCardDueInfo({
				id: `card-${date}-${i}`,
				due: `${date}T10:00:00.000Z`,
				scheduledDays: 7 + i,
				sourceUid,
			})
		);
	}
	return cards;
}

/**
 * Create sibling cards (same source) due on different dates
 */
export function createSiblingCards(
	sourceUid: string,
	dates: string[]
): CardDueInfo[] {
	return dates.map((date, i) =>
		createCardDueInfo({
			id: `sibling-${sourceUid}-${i}`,
			due: `${date}T10:00:00.000Z`,
			scheduledDays: 7,
			sourceUid,
		})
	);
}

/**
 * Create cards spread across a date range
 */
export function createCardsInRange(
	startDate: string,
	endDate: string,
	cardsPerDay: number
): CardDueInfo[] {
	const cards: CardDueInfo[] = [];
	const start = new Date(startDate);
	const end = new Date(endDate);

	const current = new Date(start);
	while (current <= end) {
		const dateStr = current.toISOString().split("T")[0]!;
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
	overloadedDays: { date: string; count: number }[]
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
	specificDates: string[] = []
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
	return date.toISOString().split("T")[0]!;
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
		const dateStr = card.due.split("T")[0]!;
		distribution.set(dateStr, (distribution.get(dateStr) ?? 0) + 1);
	}
	return distribution;
}

/**
 * Convert distribution map to array
 */
export function distributionToArray(
	distribution: Map<string, number>
): WorkloadDistribution[] {
	return Array.from(distribution.entries())
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));
}
