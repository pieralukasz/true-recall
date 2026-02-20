import { Chart } from "chart.js";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { StatsCalculatorService } from "../../../services/stats/stats-calculator.service";
import type {
	FSRSFlashcardItem,
	FutureDueEntry,
	StatsTimeRange,
} from "../../../../../shared/types";
import { getThemeColor, getThemeColorWithAlpha } from "../../../../../shared/ui/utils/theme-colors";
import {
	formatDateLabel,
	formatDateForDisplay,
	getMaxTicksForRange,
} from "../utils/chart-helpers";
import { ChartCard } from "./ChartCard";
import { SummaryList } from "./SummaryList";

export function FutureDueChart({
	statsCalculator,
	currentRange,
	onCardPreview,
}: {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
	onCardPreview: (date: string, cards: FSRSFlashcardItem[]) => void;
}) {
	const [data, setData] = useState<FutureDueEntry[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		try {
			const result = statsCalculator.getFutureDueStatsFilled(currentRange);
			setData(result);
		} catch (err) {
			console.error("Error fetching future due data:", err);
			setData([]);
		} finally {
			setLoading(false);
		}
	}, [statsCalculator, currentRange]);

	const summary = useMemo(() => {
		if (data.length === 0) return [];
		const total = data.reduce((sum, d) => sum + d.count, 0);
		const avg = Math.round(total / data.length);
		return [`Total: ${total} reviews`, `Average: ${avg} reviews/day`];
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
							label: "Cards Due",
							data: data.map((d) => d.count),
							backgroundColor: getThemeColorWithAlpha("--color-blue", 0.7),
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
							if (entry && entry.count > 0) {
								const cards = statsCalculator.getCardsDueOnDate(entry.date);
								onCardPreview(entry.date, cards);
							}
						}
					},
				},
			});
		},
		[data, currentRange, statsCalculator, onCardPreview],
	);

	if (loading) return null;

	return (
		<ChartCard
			title="Future due"
			buildChart={buildChart}
			deps={[data, currentRange]}
			isEmpty={data.length === 0}
			emptyMessage="No data available"
		>
			<SummaryList items={summary} />
		</ChartCard>
	);
}
