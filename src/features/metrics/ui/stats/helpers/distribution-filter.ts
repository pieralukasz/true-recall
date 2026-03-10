import type {
	DistributionStats,
	HistogramBucket,
} from "@features/metrics/services/fsrs-tools/statistics/distribution.calculator";
import type { FSRSFlashcardItem } from "@shared/types";
import { State } from "ts-fsrs";

type BucketDef = [min: number, max: number, label: string];

const INTERVAL_BUCKETS: BucketDef[] = [
	[0, 7, "0-7d"],
	[7, 14, "1-2w"],
	[14, 30, "2-4w"],
	[30, 60, "1-2m"],
	[60, 90, "2-3m"],
	[90, 180, "3-6m"],
	[180, 365, "6-12m"],
	[365, Infinity, "1y+"],
];

const STABILITY_BUCKETS: BucketDef[] = [
	[0, 1, "<1d"],
	[1, 3, "1-3d"],
	[3, 7, "3-7d"],
	[7, 14, "1-2w"],
	[14, 30, "2-4w"],
	[30, 60, "1-2m"],
	[60, 180, "2-6m"],
	[180, Infinity, "6m+"],
];

const DIFFICULTY_BUCKETS: BucketDef[] = [
	[1, 2, "1 (Easy)"],
	[2, 3, "2"],
	[3, 4, "3"],
	[4, 5, "4"],
	[5, 6, "5 (Medium)"],
	[6, 7, "6"],
	[7, 8, "7"],
	[8, 9, "8"],
	[9, 10, "9"],
	[10, 11, "10 (Hard)"],
];

function buildHistogram(
	values: number[],
	buckets: BucketDef[],
): HistogramBucket[] {
	const total = values.length;
	const counts = new Map<string, number>();

	for (const [, , label] of buckets) {
		counts.set(label, 0);
	}

	for (const value of values) {
		for (const [min, max, label] of buckets) {
			if (value >= min && value < max) {
				counts.set(label, (counts.get(label) ?? 0) + 1);
				break;
			}
		}
	}

	return buckets.map(([min, max, label]) => {
		const count = counts.get(label) ?? 0;
		return {
			label,
			min,
			max,
			count,
			percentage: total > 0 ? (count / total) * 100 : 0,
		};
	});
}

function calculateStats(values: number[]): DistributionStats {
	if (values.length === 0) {
		return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, count: 0 };
	}

	const sorted = [...values].sort((a, b) => a - b);
	const n = sorted.length;

	const min = sorted[0] ?? 0;
	const max = sorted[n - 1] ?? 0;
	const sum = sorted.reduce((a, b) => a + b, 0);
	const mean = sum / n;

	const median =
		n % 2 === 0
			? ((sorted[n / 2 - 1] ?? 0) + (sorted[n / 2] ?? 0)) / 2
			: (sorted[Math.floor(n / 2)] ?? 0);

	const variance =
		sorted.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) / n;
	const stdDev = Math.sqrt(variance);

	return {
		min,
		max,
		mean: Math.round(mean * 100) / 100,
		median: Math.round(median * 100) / 100,
		stdDev: Math.round(stdDev * 100) / 100,
		count: n,
	};
}

function computeDistribution(
	values: number[],
	buckets: BucketDef[],
): { histogram: HistogramBucket[]; stats: DistributionStats } {
	if (values.length === 0) {
		return {
			histogram: [],
			stats: { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, count: 0 },
		};
	}
	return {
		histogram: buildHistogram(values, buckets),
		stats: calculateStats(values),
	};
}

export function getFilteredDistributions(cards: FSRSFlashcardItem[]): {
	interval: { histogram: HistogramBucket[]; stats: DistributionStats };
	stability: { histogram: HistogramBucket[]; stats: DistributionStats };
	difficulty: { histogram: HistogramBucket[]; stats: DistributionStats };
} {
	const nonSuspended = cards.filter((c) => !c.fsrs.suspended);

	// Intervals: Review state only
	const intervalValues = nonSuspended
		.filter((c) => c.fsrs.state === State.Review)
		.map((c) => c.fsrs.scheduledDays);

	// Stability: non-New cards
	const stabilityValues = nonSuspended
		.filter((c) => c.fsrs.state !== State.New)
		.map((c) => c.fsrs.stability);

	// Difficulty: non-New cards
	const difficultyValues = nonSuspended
		.filter((c) => c.fsrs.state !== State.New)
		.map((c) => c.fsrs.difficulty);

	return {
		interval: computeDistribution(intervalValues, INTERVAL_BUCKETS),
		stability: computeDistribution(stabilityValues, STABILITY_BUCKETS),
		difficulty: computeDistribution(difficultyValues, DIFFICULTY_BUCKETS),
	};
}
