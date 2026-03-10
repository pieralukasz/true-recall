import type { RatingDistributionEntry } from "@shared/types";
import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";

interface RatingDistributionChartProps {
	data: RatingDistributionEntry[];
}

export function RatingDistributionChart({ data }: RatingDistributionChartProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useChart(
		canvasRef,
		(): ChartConfiguration<"bar"> | null => {
			if (data.length === 0) return null;
			const labels = data.map((d) => formatLabel(d.date));
			return {
				type: "bar",
				data: {
					labels,
					datasets: [
						{
							label: "Again",
							data: data.map((d) => (d.total > 0 ? (d.again / d.total) * 100 : 0)),
							backgroundColor: withAlpha(CHART_COLORS.red(), 0.8),
						},
						{
							label: "Hard",
							data: data.map((d) => (d.total > 0 ? (d.hard / d.total) * 100 : 0)),
							backgroundColor: withAlpha(CHART_COLORS.orange(), 0.8),
						},
						{
							label: "Good",
							data: data.map((d) => (d.total > 0 ? (d.good / d.total) * 100 : 0)),
							backgroundColor: withAlpha(CHART_COLORS.green(), 0.8),
						},
						{
							label: "Easy",
							data: data.map((d) => (d.total > 0 ? (d.easy / d.total) * 100 : 0)),
							backgroundColor: withAlpha(CHART_COLORS.cyan(), 0.8),
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: "top",
							labels: { color: CHART_COLORS.normal(), boxWidth: 12, padding: 8, font: { size: 11 } },
						},
						tooltip: {
							callbacks: {
								label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y ?? 0)}%`,
								title: (items) => data[items[0]?.dataIndex ?? 0]?.date ?? "",
							},
						},
					},
					scales: {
						x: {
							stacked: true,
							grid: { display: false },
							ticks: { color: CHART_COLORS.muted(), maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
						},
						y: {
							stacked: true,
							min: 0,
							max: 100,
							grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
							ticks: {
								color: CHART_COLORS.muted(),
								callback: (v) => `${v}%`,
							},
						},
					},
				},
			};
		},
		[data],
	);

	if (data.length === 0) {
		return (
			<ChartCard title="Answer Buttons" subtitle="Rating distribution">
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">No rating data yet</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard title="Answer Buttons" subtitle="Rating distribution over time">
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
