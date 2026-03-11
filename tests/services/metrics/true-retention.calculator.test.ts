import {
	TrueRetentionCalculator,
	type TrueRetentionEntry,
} from "../../../src/features/metrics/services/fsrs-tools/statistics/true-retention.calculator";

describe("TrueRetentionCalculator", () => {
	it("getSummaryAndRolling matches getSummary + getRollingAverage", () => {
		const reviews = [
			{ date: "2026-02-25", rating: 4 },
			{ date: "2026-02-25", rating: 3 },
			{ date: "2026-02-26", rating: 1 },
			{ date: "2026-02-26", rating: 4 },
			{ date: "2026-02-27", rating: 3 },
			{ date: "2026-02-27", rating: 3 },
			{ date: "2026-02-28", rating: 2 },
			{ date: "2026-03-01", rating: 4 },
			{ date: "2026-03-02", rating: 3 },
			{ date: "2026-03-03", rating: 1 },
			{ date: "2026-03-04", rating: 3 },
			{ date: "2026-03-05", rating: 4 },
			{ date: "2026-03-06", rating: 4 },
			{ date: "2026-03-07", rating: 3 },
			{ date: "2026-03-08", rating: 2 },
			{ date: "2026-03-09", rating: 4 },
			{ date: "2026-03-10", rating: 3 },
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
			getReviewsForRetention: vi.fn(() => [] as { date: string; rating: number }[]),
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
