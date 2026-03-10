import type { CardsCreatedEntry, ExtendedDailyStats } from "@shared/types";
import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";

interface CreatedVsReviewedChartProps {
	created: CardsCreatedEntry[];
	reviewHistory: ExtendedDailyStats[];
}

export function CreatedVsReviewedChart({ created, reviewHistory }: CreatedVsReviewedChartProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const reviewMap = new Map(reviewHistory.map((d) => [d.date, d.reviewsCompleted]));

	useChart(
		canvasRef,
		(): ChartConfiguration<"line"> | null => {
			if (created.length === 0) return null;
			const labels = created.map((d) => formatLabel(d.date));
			return {
				type: "line",
				data: {
					labels,
					datasets: [
						{
							label: "Created",
							data: created.map((d) => d.count),
							borderColor: CHART_COLORS.green(),
							backgroundColor: withAlpha(CHART_COLORS.green(), 0.1),
							fill: true,
							tension: 0.3,
							pointRadius: created.length > 30 ? 0 : 3,
						},
						{
							label: "Reviewed",
							data: created.map((d) => reviewMap.get(d.date) ?? 0),
							borderColor: CHART_COLORS.blue(),
							backgroundColor: withAlpha(CHART_COLORS.blue(), 0.1),
							fill: true,
							tension: 0.3,
							pointRadius: created.length > 30 ? 0 : 3,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							labels: { color: CHART_COLORS.normal(), boxWidth: 12, padding: 8, font: { size: 11 } },
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
		[created, reviewHistory],
	);

	if (created.length === 0) {
		return (
			<ChartCard title="Created vs Reviewed">
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">No data yet</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard title="Created vs Reviewed" subtitle="Card creation compared to review activity">
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
