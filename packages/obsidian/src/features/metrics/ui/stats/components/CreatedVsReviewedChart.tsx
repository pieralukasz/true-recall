import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";

import type { CardsCreatedEntry, ExtendedDailyStats } from "@true-recall/core";

import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../helpers/use-chart";
import { ChartCard } from "./ChartCard";

interface CreatedVsReviewedChartProps {
	created: CardsCreatedEntry[];
	reviewHistory: ExtendedDailyStats[];
}

export function CreatedVsReviewedChart({
	created,
	reviewHistory,
}: CreatedVsReviewedChartProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useChart(canvasRef, (): ChartConfiguration<"bar"> | null => {
		// Merge dates
		const dateSet = new Set<string>();
		for (const c of created) dateSet.add(c.date);
		for (const r of reviewHistory) dateSet.add(r.date);
		const dates = Array.from(dateSet).sort();
		if (dates.length === 0) return null;

		const createdMap = new Map(created.map((c) => [c.date, c.count]));
		const reviewedMap = new Map(
			reviewHistory.map((r) => [r.date, r.reviewsCompleted]),
		);

		return {
			type: "bar",
			data: {
				labels: dates.map((d) => {
					const dt = new Date(d);
					return `${dt.getMonth() + 1}/${dt.getDate()}`;
				}),
				datasets: [
					{
						label: "Created",
						data: dates.map((d) => createdMap.get(d) ?? 0),
						backgroundColor: withAlpha(CHART_COLORS.green(), 0.7),
					},
					{
						label: "Reviewed",
						data: dates.map((d) => reviewedMap.get(d) ?? 0),
						backgroundColor: withAlpha(CHART_COLORS.blue(), 0.7),
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						labels: {
							color: CHART_COLORS.normal(),
							boxWidth: 12,
							padding: 8,
							font: { size: 11 },
						},
					},
				},
				scales: {
					x: {
						grid: { display: false },
						ticks: {
							color: CHART_COLORS.muted(),
							maxRotation: 0,
							autoSkip: true,
							maxTicksLimit: 10,
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
	}, [created, reviewHistory]);

	if (created.length === 0 && reviewHistory.length === 0) {
		return (
			<ChartCard
				title="Created vs Reviewed"
				subtitle="New cards vs reviews over time"
			>
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">
					No data yet
				</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard
			title="Created vs Reviewed"
			subtitle="New cards vs reviews over time"
		>
			<div class="ep:h-48">
				<canvas ref={canvasRef} />
			</div>
		</ChartCard>
	);
}
