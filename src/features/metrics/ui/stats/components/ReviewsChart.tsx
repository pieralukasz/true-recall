import type { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { ChartCard } from "@features/metrics/ui/stats/components/ChartCard";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";
import { SummaryList } from "@features/metrics/ui/stats/components/SummaryList";
import {
	formatDateForDisplay,
	formatDateLabel,
	getMaxTicksForRange,
} from "@features/metrics/ui/stats/utils/chart-helpers";
import type {
	ExtendedDailyStats,
	FSRSFlashcardItem,
	StatsTimeRange,
} from "@shared/types";
import {
	getThemeColor,
	getThemeColorWithAlpha,
} from "@shared/ui/utils/theme-colors";
import { Chart } from "chart.js";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

export function ReviewsChart({
	statsCalculator,
	currentRange,
	onCardPreview,
}: {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
	onCardPreview: (date: string, cards: FSRSFlashcardItem[]) => void;
}) {
	const [data, setData] = useState<ExtendedDailyStats[]>([]);

	useEffect(() => {
		if (currentRange === "backlog") {
			setData([]);
			return;
		}
		statsCalculator
			.getReviewHistory(currentRange)
			.then(setData)
			.catch(() => setData([]));
	}, [statsCalculator, currentRange]);

	const summary = useMemo(() => {
		if (data.length === 0) return [];
		const totalReviewed = data.reduce(
			(sum, d) => sum + d.reviewsCompleted,
			0,
		);
		const daysStudied = data.filter((d) => d.reviewsCompleted > 0).length;
		const totalDays = data.length;
		const percentStudied =
			totalDays > 0 ? ((daysStudied / totalDays) * 100).toFixed(1) : "0";
		const avgPerDay =
			totalDays > 0 ? Math.round(totalReviewed / totalDays) : 0;
		const avgPerStudyDay =
			daysStudied > 0 ? Math.round(totalReviewed / daysStudied) : 0;

		const items: string[] = [
			`Days studied: ${daysStudied} of ${totalDays} (${percentStudied}%)`,
			`Total: ${totalReviewed.toLocaleString()} reviews`,
			`Average over period: ${avgPerDay} reviews/day`,
		];

		if (daysStudied > 0 && daysStudied !== totalDays) {
			items.push(
				`Average for days studied: ${avgPerStudyDay} reviews/day`,
			);
		}
		return items;
	}, [data]);

	const buildChart = useCallback(
		(canvas: HTMLCanvasElement) => {
			const maxTicks = getMaxTicksForRange(currentRange);

			return new Chart(canvas, {
				type: "bar",
				data: {
					labels: data.map((d) => formatDateLabel(d.date)),
					datasets: [
						{
							label: "Reviewed",
							data: data.map((d) => d.reviewsCompleted),
							backgroundColor: getThemeColorWithAlpha(
								"--color-blue",
								0.7,
							),
							borderColor: getThemeColor("--color-blue"),
							borderWidth: 1,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								title: (items) => {
									if (items.length > 0)
										return formatDateForDisplay(
											data[items[0]?.dataIndex ?? 0]
												?.date ?? "",
										);
									return "";
								},
							},
						},
					},
					scales: {
						y: { beginAtZero: true, ticks: { precision: 0 } },
						x: {
							ticks: {
								maxRotation: 45,
								minRotation: 45,
								maxTicksLimit: maxTicks,
							},
						},
					},
					onClick: (_event, elements) => {
						if (elements.length > 0) {
							const entry = data[elements[0]?.index ?? 0];
							if (entry && entry.reviewsCompleted > 0) {
								const cards =
									statsCalculator.getCardsDueOnDate(
										entry.date,
									);
								onCardPreview(entry.date, cards);
							}
						}
					},
				},
			});
		},
		[data, currentRange, statsCalculator, onCardPreview],
	);

	if (currentRange === "backlog") {
		return (
			<StatsCard title="Reviews">
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-52 ep:text-obs-muted ep:text-ui-small ep:italic">
					Select a time range to see reviews
				</div>
			</StatsCard>
		);
	}

	return (
		<ChartCard
			title="Reviews"
			buildChart={buildChart}
			deps={[data, currentRange]}
			isEmpty={data.length === 0}
			emptyMessage="No data available"
		>
			<SummaryList items={summary} />
		</ChartCard>
	);
}
