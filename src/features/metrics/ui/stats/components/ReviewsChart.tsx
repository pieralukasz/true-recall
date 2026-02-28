import type { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { ChartCard } from "@features/metrics/ui/stats/components/ChartCard";
import { ChartToggleBar } from "@features/metrics/ui/stats/components/ChartToggleBar";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";
import { SummaryList } from "@features/metrics/ui/stats/components/SummaryList";
import {
	formatDateForDisplay,
	formatDateLabel,
	getMaxTicksForRange,
} from "@features/metrics/ui/stats/utils/chart-helpers";
import type {
	CardsCreatedVsReviewedEntry,
	FSRSFlashcardItem,
	StatsTimeRange,
} from "@shared/types";
import {
	getThemeColor,
	getThemeColorWithAlpha,
} from "@shared/ui/utils/theme-colors";
import { Chart, type ChartDataset } from "chart.js";
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
	const [data, setData] = useState<CardsCreatedVsReviewedEntry[]>([]);
	const [visibility, setVisibility] = useState({
		created: false,
		reviewed: true,
		createdAndReviewedSameDay: false,
	});

	useEffect(() => {
		if (currentRange === "backlog") {
			setData([]);
			return;
		}
		try {
			const result =
				statsCalculator.getCardsCreatedVsReviewedHistory(currentRange);
			setData(result);
		} catch (err) {
			console.error("Error fetching reviews data:", err);
			setData([]);
		}
	}, [statsCalculator, currentRange]);

	const toggleVisibility = useCallback((key: keyof typeof visibility) => {
		setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
	}, []);

	const summary = useMemo(() => {
		if (data.length === 0) return [];
		const totalReviewed = data.reduce((sum, d) => sum + d.reviewed, 0);
		const totalCreated = data.reduce((sum, d) => sum + d.created, 0);
		const daysStudied = data.filter((d) => d.reviewed > 0).length;
		const totalDays = data.length;
		const percentStudied =
			totalDays > 0 ? ((daysStudied / totalDays) * 100).toFixed(1) : "0";
		const avgPerDay = totalDays > 0 ? Math.round(totalReviewed / totalDays) : 0;
		const avgPerStudyDay =
			daysStudied > 0 ? Math.round(totalReviewed / daysStudied) : 0;

		const items: string[] = [
			`Days studied: ${daysStudied} of ${totalDays} (${percentStudied}%)`,
			`Total: ${totalReviewed.toLocaleString()} reviews`,
			`Average over period: ${avgPerDay} reviews/day`,
		];

		if (daysStudied > 0 && daysStudied !== totalDays) {
			items.push(`Average for days studied: ${avgPerStudyDay} reviews/day`);
		}
		if (visibility.created) {
			items.push(`Total created: ${totalCreated.toLocaleString()} cards`);
		}
		return items;
	}, [data, visibility.created]);

	const buildChart = useCallback(
		(canvas: HTMLCanvasElement) => {
			const maxTicks = getMaxTicksForRange(currentRange);
			const datasets: ChartDataset<"bar", number[]>[] = [];

			if (visibility.reviewed) {
				datasets.push({
					label: "Reviewed",
					data: data.map((d) => d.reviewed),
					backgroundColor: getThemeColorWithAlpha("--color-blue", 0.7),
					borderColor: getThemeColor("--color-blue"),
					borderWidth: 1,
				});
			}
			if (visibility.created) {
				datasets.push({
					label: "Created",
					data: data.map((d) => d.created),
					backgroundColor: getThemeColorWithAlpha("--color-green", 0.7),
					borderColor: getThemeColor("--color-green"),
					borderWidth: 1,
				});
			}
			if (visibility.createdAndReviewedSameDay) {
				datasets.push({
					label: "Same Day",
					data: data.map((d) => d.createdAndReviewedSameDay),
					backgroundColor: getThemeColorWithAlpha("--color-orange", 0.8),
					borderColor: getThemeColor("--color-orange"),
					borderWidth: 1,
				});
			}

			return new Chart(canvas, {
				type: "bar",
				data: {
					labels: data.map((d) => formatDateLabel(d.date)),
					datasets,
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
											data[items[0]?.dataIndex ?? 0]?.date ?? "",
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
							if (entry && (entry.created > 0 || entry.reviewed > 0)) {
								const cards = statsCalculator.getCardsDueOnDate(entry.date);
								onCardPreview(entry.date, cards);
							}
						}
					},
				},
			});
		},
		[data, currentRange, visibility, statsCalculator, onCardPreview],
	);

	const isBacklog = currentRange === "backlog";

	const controlDefs = useMemo(
		() => [
			{
				key: "reviewed" as const,
				label: "Reviewed",
				color: getThemeColorWithAlpha("--color-blue", 0.9),
			},
			{
				key: "created" as const,
				label: "Created",
				color: getThemeColorWithAlpha("--color-green", 0.9),
			},
			{
				key: "createdAndReviewedSameDay" as const,
				label: "Same Day",
				color: getThemeColorWithAlpha("--color-orange", 0.9),
			},
		],
		[],
	);

	if (isBacklog) {
		return (
			<StatsCard title="Reviews">
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-52 ep:text-obs-muted ep:text-ui-small ep:italic">
					Select a time range to see reviews
				</div>
			</StatsCard>
		);
	}

	const controls = (
		<ChartToggleBar
			toggles={controlDefs}
			visibility={visibility}
			onToggle={toggleVisibility}
		/>
	);

	return (
		<ChartCard
			title="Reviews"
			buildChart={buildChart}
			deps={[data, currentRange, visibility]}
			isEmpty={data.length === 0}
			emptyMessage="No data available"
			aboveCanvas={controls}
		>
			<SummaryList items={summary} />
		</ChartCard>
	);
}
