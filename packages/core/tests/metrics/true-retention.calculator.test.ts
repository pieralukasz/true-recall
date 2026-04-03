import {
	TrueRetentionCalculator,
	type TrueRetentionEntry,
} from "../../src/metrics/fsrs-tools/statistics/true-retention.calculator";

function daysAgo(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toISOString().slice(0, 10);
}

describe("TrueRetentionCalculator", () => {
	it("getSummaryAndRolling matches getSummary + getRollingAverage", () => {
		const reviews = [
			{ date: daysAgo(20), rating: 4 },
			{ date: daysAgo(20), rating: 3 },
			{ date: daysAgo(19), rating: 1 },
			{ date: daysAgo(19), rating: 4 },
			{ date: daysAgo(18), rating: 3 },
			{ date: daysAgo(18), rating: 3 },
			{ date: daysAgo(17), rating: 2 },
			{ date: daysAgo(15), rating: 4 },
			{ date: daysAgo(13), rating: 3 },
			{ date: daysAgo(11), rating: 1 },
			{ date: daysAgo(9), rating: 3 },
			{ date: daysAgo(7), rating: 4 },
			{ date: daysAgo(6), rating: 4 },
			{ date: daysAgo(5), rating: 3 },
			{ date: daysAgo(4), rating: 2 },
			{ date: daysAgo(3), rating: 4 },
			{ date: daysAgo(2), rating: 3 },
		];
		const cardStore = {
			getReviewsForRetention: vi.fn(() => reviews),
		};
		const calculator = new TrueRetentionCalculator(cardStore as any);
		const target = 0.9;
		const days = 30;
		const window = 7;
		const presets = ["Default"];

		const summary = calculator.getSummary(target, days, presets);
		const history = calculator.getRollingAverage(days, window, presets);
		const snapshot = calculator.getSummaryAndRolling(
			target,
			days,
			window,
			presets,
		);

		expect(snapshot.summary).toEqual(summary);
		expect(snapshot.history).toEqual(history);
		expect(cardStore.getReviewsForRetention).toHaveBeenCalled();
	});

	it("returns empty snapshot for empty review history", () => {
		const cardStore = {
			getReviewsForRetention: vi.fn(
				() => [] as { date: string; rating: number }[],
			),
		};
		const calculator = new TrueRetentionCalculator(cardStore as any);

		const snapshot = calculator.getSummaryAndRolling(0.9, 30, 7, ["Default"]);

		expect(snapshot.summary).toEqual({
			current: 0,
			target: 0.9,
			trend: 0,
			average: 0,
			totalReviews: 0,
		});
		expect(snapshot.history).toEqual([] as TrueRetentionEntry[]);
	});
});
