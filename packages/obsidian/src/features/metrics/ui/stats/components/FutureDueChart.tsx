import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";

import type { FutureDueEntry } from "@true-recall/core";

import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../helpers/use-chart";
import { ChartCard } from "./ChartCard";

interface FutureDueChartProps {
	data: FutureDueEntry[];
}

function FutureDueChart({ data }: FutureDueChartProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useChart(canvasRef, (): ChartConfiguration<"bar"> | null => {
		if (data.length === 0) return null;
		return {
			type: "bar",
			data: {
				labels: data.map((d) => {
					const dt = new Date(d.date);
					return `${dt.getMonth() + 1}/${dt.getDate()}`;
				}),
				datasets: [
					{
						label: "Due",
						data: data.map((d) => d.count),
						backgroundColor: withAlpha(CHART_COLORS.blue(), 0.7),
						borderRadius: 3,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
				},
				scales: {
					x: {
						grid: { display: false },
						ticks: {
							color: CHART_COLORS.muted(),
							maxRotation: 0,
							autoSkip: true,
						},
					},
					y: {
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
			<ChartCard title="Future Due" subtitle="Cards due in coming days">
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">
					No forecast data
				</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard title="Future Due" subtitle="Cards due in coming days">
			<div class="ep:h-48">
				<canvas ref={canvasRef} />
			</div>
		</ChartCard>
	);
}
