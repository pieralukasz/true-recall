/**
 * R-Mode aggregation for the dashboard.
 *
 * The due-date dashboard must stay byte-identical when R-Mode is off, and the
 * spread must combine across notes without averaging averages.
 */

import { State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import {
	aggregateDashboardData,
	mergeRetrievability,
} from "../../src/helpers/note-aggregation";
import type { NoteRetrievability } from "../../src/types/dashboard.types";
import type { CardSchedulingMeta } from "../../src/types/fsrs/card.types";
import type { TodaySummary } from "../../src/types/fsrs/stats.types";

const TODAY_SUMMARY = {
	studied: 0,
	minutes: 0,
	newCards: 0,
	reviewCards: 0,
} as unknown as TodaySummary;

function reviewCard(
	id: string,
	noteName: string,
	dueOffsetDays: number,
): CardSchedulingMeta {
	return {
		id,
		sourceUid: `uid-${noteName}`,
		sourceNoteName: noteName,
		sourceNotePath: `${noteName}.md`,
		fsrs: {
			state: State.Review,
			due: new Date(Date.now() + dueOffsetDays * 86_400_000).toISOString(),
			stability: 10,
			difficulty: 5,
			scheduledDays: 10,
			elapsedDays: 0,
			reps: 3,
			lapses: 0,
			lastReview: new Date().toISOString(),
		},
	} as unknown as CardSchedulingMeta;
}

function aggregate(
	cards: CardSchedulingMeta[],
	rValues?: Record<string, number>,
) {
	return aggregateDashboardData({
		allCards: cards,
		streakCurrent: 0,
		todaySummary: TODAY_SUMMARY,
		newCardsCap: 20,
		reviewsCap: 200,
		retrievability: rValues
			? {
					getScore: (card) => ({
						r: rValues[card.id] ?? 1,
						ceiling: 0.95,
						comfortFloor: 0.9,
					}),
					urgentBelow: 0.5,
				}
			: undefined,
	});
}

describe("dashboard aggregation — retrievability", () => {
	it("leaves entries untouched when R-Mode is off", () => {
		const result = aggregate([reviewCard("a", "Note", -1)]);

		expect(result.notes[0]?.retrievability).toBeUndefined();
		expect(result.notes[0]?.due).toBe(1);
	});

	it("splits a note's review cards across bands", () => {
		const cards = [
			reviewCard("urgent", "Note", -30),
			reviewCard("losing", "Note", -5),
			reviewCard("known", "Note", 1),
			reviewCard("fresh", "Note", 9),
		];

		const result = aggregate(cards, {
			urgent: 0.3,
			losing: 0.7,
			known: 0.92,
			fresh: 0.99,
		});

		const spread = result.notes[0]?.retrievability;
		expect(spread).toEqual({
			urgent: 1,
			losing: 1,
			known: 1,
			fresh: 1,
			pool: 3,
			total: 4,
			sumR: 0.3 + 0.7 + 0.92 + 0.99,
		});
	});

	it("keeps the due count alongside the spread", () => {
		const result = aggregate([reviewCard("a", "Note", -1)], { a: 0.4 });

		expect(result.notes[0]?.due).toBe(1);
		expect(result.notes[0]?.retrievability?.urgent).toBe(1);
	});

	it("reports the pool total only in R-Mode", () => {
		const cards = [reviewCard("a", "A", 5), reviewCard("b", "B", 5)];

		expect(aggregate(cards).totalPool).toBeUndefined();
		expect(aggregate(cards, { a: 0.6, b: 0.99 }).totalPool).toBe(1);
	});

	it("includes orphan review cards in the global pool", () => {
		const orphan = reviewCard("orphan", "Temporary", 5);
		orphan.sourceNoteName = undefined;
		orphan.sourceNotePath = undefined;

		const result = aggregate([orphan], { orphan: 0.6 });

		expect(result.totalPool).toBe(1);
		expect(result.notes).toHaveLength(0);
	});

	it("drives priority from the bands rather than from lateness", () => {
		// Not due for another 5 days, but already below the urgent threshold.
		const result = aggregate([reviewCard("a", "Note", 5)], { a: 0.3 });

		expect(result.notes[0]?.due).toBe(0);
		expect(result.notes[0]?.priority).toBe("overdue");
	});

	it("estimates study time from the pool, not the due count", () => {
		const cards = [reviewCard("a", "Note", 5), reviewCard("b", "Note", 5)];

		const dueMode = aggregate(cards);
		const rMode = aggregate(cards, { a: 0.6, b: 0.7 });

		expect(dueMode.notes[0]?.estimatedMinutes).toBe(0);
		expect(rMode.notes[0]?.estimatedMinutes).toBeGreaterThan(0);
	});

	it("separates learning due now from learning scheduled later", () => {
		const due = reviewCard("due-learning", "Note", 0);
		due.fsrs.state = State.Learning;
		due.fsrs.due = new Date(Date.now() - 60_000).toISOString();
		const pending = reviewCard("pending-learning", "Note", 0);
		pending.fsrs.state = State.Relearning;
		pending.fsrs.due = new Date(Date.now() + 60_000).toISOString();

		const result = aggregate([due, pending]);

		expect(result.totalLearning).toBe(1);
		expect(result.totalLearningPending).toBe(1);
		expect(result.notes[0]?.learning).toBe(1);
		expect(result.notes[0]?.learningPending).toBe(1);
	});
});

describe("mergeRetrievability", () => {
	const part = (over: Partial<NoteRetrievability>): NoteRetrievability => ({
		urgent: 0,
		losing: 0,
		known: 0,
		fresh: 0,
		pool: 0,
		total: 0,
		sumR: 0,
		...over,
	});

	it("sums children instead of averaging their averages", () => {
		const merged = mergeRetrievability([
			part({ known: 1, pool: 1, total: 1, sumR: 0.9 }),
			part({ urgent: 99, pool: 99, total: 99, sumR: 9.9 }),
		]);

		expect(merged?.total).toBe(100);
		expect(merged?.pool).toBe(100);
		// A naive mean of means would report ~0.5; weighted is ~0.108.
		expect((merged?.sumR ?? 0) / (merged?.total ?? 1)).toBeCloseTo(0.108, 3);
	});

	it("returns undefined when no child carries a spread", () => {
		expect(mergeRetrievability([undefined, undefined])).toBeUndefined();
	});
});
