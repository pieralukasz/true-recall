import type { FutureDueEntry } from "@shared/types";
import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";

interface FutureDueChartProps {
	data: FutureDueEntry[];
}

export function FutureDueChart({ data }: FutureDueChartProps) {
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
							label: "Due",
							data: data.map((d) => d.count),
							backgroundColor: withAlpha(CHART_COLORS.blue(), 0.7),
							borderRadius: 2,
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
								title: (items) => data[items[0]?.dataIndex ?? 0]?.date ?? "",
							},
						},
					},
					scales: {
						x: {
							grid: { display: false },
							ticks: { color: CHART_COLORS.muted(), maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
						},
						y: {
							beginAtZero: true,
							grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
							ticks: { color: CHART_COLORS.muted() },
						},
					},
				},
			};
		},
		[data],
	);

	if (data.length === 0) {
		return (
			<ChartCard title="Future Due" subtitle="Upcoming review workload">
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">No cards scheduled</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard title="Future Due" subtitle="Upcoming review workload">
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
