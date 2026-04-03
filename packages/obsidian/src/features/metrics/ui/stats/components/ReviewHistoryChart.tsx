import type { ExtendedDailyStats } from "@true-recall/core";
import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../helpers/use-chart";
import { ChartCard } from "./ChartCard";

interface ReviewHistoryChartProps {
	data: ExtendedDailyStats[];
}

export function ReviewHistoryChart({ data }: ReviewHistoryChartProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useChart(canvasRef, (): ChartConfiguration<"bar"> | null => {
		if (data.length === 0) return null;
		const labels = data.map((d) => formatLabel(d.date));
		return {
			type: "bar",
			data: {
				labels,
				datasets: [
					{
						label: "New",
						data: data.map((d) => d.newCards ?? 0),
						backgroundColor: withAlpha(CHART_COLORS.green(), 0.8),
					},
					{
						label: "Learning",
						data: data.map((d) => d.learningCards ?? 0),
						backgroundColor: withAlpha(CHART_COLORS.orange(), 0.8),
					},
					{
						label: "Review",
						data: data.map((d) => d.reviewCards ?? 0),
						backgroundColor: withAlpha(CHART_COLORS.blue(), 0.8),
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: "top",
						labels: {
							color: CHART_COLORS.normal(),
							boxWidth: 12,
							padding: 8,
							font: { size: 11 },
						},
					},
					tooltip: {
						callbacks: {
							title: (items) => data[items[0]?.dataIndex ?? 0]?.date ?? "",
						},
					},
				},
				scales: {
					x: {
						stacked: true,
						grid: { display: false },
						ticks: {
							color: CHART_COLORS.muted(),
							maxRotation: 0,
							autoSkip: true,
							maxTicksLimit: 10,
						},
					},
					y: {
						stacked: true,
						beginAtZero: true,
						grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
						ticks: { color: CHART_COLORS.muted() },
					},
				},
			},
		};
	}, [data]);

	if (data.length === 0) {
		return (
			<ChartCard title="Review History" subtitle="Daily review breakdown">
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">
					No review data yet
				</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard title="Review History" subtitle="Daily review breakdown">
			<div class="ep:h-48">
				<canvas ref={canvasRef} />
			</div>
		</ChartCard>
	);
}

function formatLabel(date: string): string {
	const d = new Date(date);
	return `${d.getMonth() + 1}/${d.getDate()}`;
}
