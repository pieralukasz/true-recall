import { describe, expect, it } from "vitest";
import { State } from "ts-fsrs";
import { getFilteredDistributions } from "@features/metrics/ui/stats/helpers/distribution-filter";
import type { FSRSFlashcardItem } from "@shared/types";
import type { FSRSCardData } from "@shared/types";

function makeCard(
	overrides: Partial<FSRSCardData> & { state: State },
): FSRSFlashcardItem {
	const fsrs: FSRSCardData = {
		id: crypto.randomUUID(),
		due: new Date().toISOString(),
		stability: 1,
		difficulty: 5,
		reps: 0,
		lapses: 0,
		lastReview: null,
		scheduledDays: 0,
		learningStep: 0,
		suspended: false,
		...overrides,
	};
	return {
		id: fsrs.id,
		question: "Q",
		answer: "A",
		fsrs,
	};
}

describe("getFilteredDistributions", () => {
	it("returns empty histograms and zero stats for empty cards", () => {
		const result = getFilteredDistributions([]);

		expect(result.interval.histogram).toEqual([]);
		expect(result.interval.stats).toEqual({
			min: 0,
			max: 0,
			mean: 0,
			median: 0,
			stdDev: 0,
			count: 0,
		});
		expect(result.stability.histogram).toEqual([]);
		expect(result.stability.stats.count).toBe(0);
		expect(result.difficulty.histogram).toEqual([]);
		expect(result.difficulty.stats.count).toBe(0);
	});

	it("places cards with known intervals into correct buckets", () => {
		const cards = [
			makeCard({ state: State.Review, scheduledDays: 5 }),
			makeCard({ state: State.Review, scheduledDays: 10 }),
			makeCard({ state: State.Review, scheduledDays: 20 }),
			makeCard({ state: State.Review, scheduledDays: 100 }),
			makeCard({ state: State.Review, scheduledDays: 400 }),
		];

		const result = getFilteredDistributions(cards);
		const bucketMap = new Map(
			result.interval.histogram.map((b) => [b.label, b.count]),
		);

		// scheduledDays=5 -> [0,7) -> "0-7d"
		expect(bucketMap.get("0-7d")).toBe(1);
		// scheduledDays=10 -> [7,14) -> "1-2w"
		expect(bucketMap.get("1-2w")).toBe(1);
		// scheduledDays=20 -> [14,30) -> "2-4w"
		expect(bucketMap.get("2-4w")).toBe(1);
		// scheduledDays=100 -> [90,180) -> "3-6m"
		expect(bucketMap.get("3-6m")).toBe(1);
		// scheduledDays=400 -> [365,Inf) -> "1y+"
		expect(bucketMap.get("1y+")).toBe(1);
	});

	it("filters out suspended cards from all distributions", () => {
		const cards = [
			makeCard({
				state: State.Review,
				scheduledDays: 5,
				stability: 10,
				difficulty: 5,
				suspended: true,
			}),
		];

		const result = getFilteredDistributions(cards);

		expect(result.interval.stats.count).toBe(0);
		expect(result.stability.stats.count).toBe(0);
		expect(result.difficulty.stats.count).toBe(0);
	});

	it("excludes New state cards from interval, stability, and difficulty", () => {
		const cards = [
			makeCard({ state: State.New, scheduledDays: 0, stability: 0, difficulty: 5 }),
			makeCard({ state: State.Review, scheduledDays: 10, stability: 7, difficulty: 3 }),
		];

		const result = getFilteredDistributions(cards);

		// Interval: only Review state cards
		expect(result.interval.stats.count).toBe(1);
		// Stability & difficulty: non-New cards only
		expect(result.stability.stats.count).toBe(1);
		expect(result.difficulty.stats.count).toBe(1);
	});

	it("computes correct mean and median for known values", () => {
		// Use stability values [1, 2, 3, 4, 5] via Learning cards (non-New, non-Review)
		const cards = [1, 2, 3, 4, 5].map((s) =>
			makeCard({ state: State.Learning, stability: s, difficulty: 5 }),
		);

		const result = getFilteredDistributions(cards);

		expect(result.stability.stats.mean).toBe(3);
		expect(result.stability.stats.median).toBe(3);
		expect(result.stability.stats.count).toBe(5);
		expect(result.stability.stats.min).toBe(1);
		expect(result.stability.stats.max).toBe(5);
	});
});
