import { Chart } from "chart.js";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { StatsCalculatorService } from "../../../services/stats/stats-calculator.service";
import type { RetentionEntry, StatsTimeRange } from "../../../../../shared/types";
import { getThemeColor, getThemeColorWithAlpha } from "../../../../../shared/ui/utils/theme-colors";
import {
	formatDateLabel,
	formatDateForDisplay,
	getMaxTicksForRange,
} from "../utils/chart-helpers";
import { ChartCard } from "./ChartCard";
import { SummaryList } from "./SummaryList";

export function RetentionChart({
	statsCalculator,
	currentRange,
}: {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
}) {
	const [data, setData] = useState<RetentionEntry[]>([]);

	useEffect(() => {
		try {
			const result = statsCalculator.getRetentionHistory(currentRange);
			setData(result);
		} catch (err) {
			console.error("Error fetching retention data:", err);
			setData([]);
		}
	}, [statsCalculator, currentRange]);

	const summary = useMemo(() => {
		if (data.length === 0) return [];
		const avgRetention = Math.round(
			data.reduce((sum, d) => sum + d.retention, 0) / data.length,
		);
		const totalReviews = data.reduce((sum, d) => sum + d.total, 0);
		return [`Average: ${avgRetention}%`, `Total reviews: ${totalReviews}`];
	}, [data]);

	const buildChart = useCallback(
		(canvas: HTMLCanvasElement) => {
			const maxTicks = getMaxTicksForRange(currentRange);
			return new Chart(canvas, {
				type: "line",
				data: {
					labels: data.map((d) => formatDateLabel(d.date)),
					datasets: [
						{
							label: "Retention %",
							data: data.map((d) => d.retention),
							borderColor: getThemeColor("--color-green"),
							backgroundColor: getThemeColorWithAlpha("--color-green", 0.1),
							fill: true,
							tension: 0.3,
							pointRadius: data.length > 30 ? 0 : 3,
							pointHoverRadius: 5,
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
								label: (context) => {
									const entry = data[context.dataIndex];
									return entry
										? `${entry.retention}% (${entry.total} reviews)`
										: "";
								},
							},
						},
					},
					scales: {
						y: {
							min: 0,
							max: 100,
							ticks: { callback: (value) => `${value}%` },
						},
						x: {
							ticks: {
								maxRotation: 45,
								minRotation: 45,
								maxTicksLimit: maxTicks,
							},
						},
					},
				},
			});
		},
		[data, currentRange],
	);

	return (
		<ChartCard
			title="Retention rate"
			buildChart={buildChart}
			deps={[data, currentRange]}
			isEmpty={data.length === 0}
			emptyMessage="No data available"
		>
			<SummaryList items={summary} />
		</ChartCard>
	);
}
