import type {
	WorkloadForecastEntry,
	WorkloadForecastSummary,
} from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";
import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../helpers/use-chart";
import { ChartCard } from "./ChartCard";

interface WorkloadForecastSectionProps {
	forecast: WorkloadForecastEntry[];
	summary: WorkloadForecastSummary;
	dayOfWeek: { day: number; dayName: string; avgCount: number }[];
}

export function WorkloadForecastSection({
	forecast,
	summary,
	dayOfWeek,
}: WorkloadForecastSectionProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const dowCanvasRef = useRef<HTMLCanvasElement>(null);

	useChart(canvasRef, (): ChartConfiguration<"bar"> | null => {
		if (forecast.length === 0) return null;
		const labels = forecast.map((d) => formatLabel(d.date));
		return {
			type: "bar",
			data: {
				labels,
				datasets: [
					{
						label: "Review",
						data: forecast.map((d) => d.breakdown.review),
						backgroundColor: withAlpha(CHART_COLORS.blue(), 0.7),
						borderRadius: 2,
					},
					{
						label: "Learning",
						data: forecast.map((d) => d.breakdown.learning),
						backgroundColor: withAlpha(CHART_COLORS.orange(), 0.7),
						borderRadius: 2,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: "top",
						labels: {
							color: CHART_COLORS.muted(),
							boxWidth: 10,
							padding: 12,
							font: { size: 11 },
						},
					},
					tooltip: {
						callbacks: {
							title: (items) => forecast[items[0]?.dataIndex ?? 0]?.date ?? "",
							footer: (items) => {
								const idx = items[0]?.dataIndex ?? 0;
								const entry = forecast[idx];
								return entry ? `Total: ${String(entry.dueCount)}` : "";
							},
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
	}, [forecast]);

	useChart(dowCanvasRef, (): ChartConfiguration<"bar"> | null => {
		if (dayOfWeek.length === 0) return null;
		const sunday = dayOfWeek[0];
		if (!sunday) return null;
		const reordered = [...dayOfWeek.slice(1), sunday];
		return {
			type: "bar",
			data: {
				labels: reordered.map((d) => d.dayName.slice(0, 3)),
				datasets: [
					{
						label: "Avg",
						data: reordered.map((d) => d.avgCount),
						backgroundColor: withAlpha(CHART_COLORS.purple(), 0.6),
						borderRadius: 3,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false } },
				scales: {
					x: {
						grid: { display: false },
						ticks: { color: CHART_COLORS.muted(), font: { size: 10 } },
					},
					y: {
						beginAtZero: true,
						grid: { color: withAlpha(CHART_COLORS.border(), 0.3) },
						ticks: { color: CHART_COLORS.muted(), font: { size: 10 } },
					},
				},
			},
		};
	}, [dayOfWeek]);

	if (forecast.length === 0) {
		return (
			<ChartCard
				title="Workload Forecast"
				subtitle="Predicted daily reviews (next 30 days)"
			>
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">
					No cards scheduled
				</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard
			title="Workload Forecast"
			subtitle="Predicted daily reviews (next 30 days)"
		>
			<div class="ep:h-48">
				<canvas ref={canvasRef} />
			</div>

			<div class="ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1 ep:mt-3 ep:text-xs ep:text-obs-muted">
				<span>Avg: {summary.avgDaily}/day</span>
				<span>
					Peak: {summary.peakDay.count} ({formatShortDate(summary.peakDay.date)}
					)
				</span>
				<span>
					Min: {summary.minDay.count} ({formatShortDate(summary.minDay.date)})
				</span>
				{summary.daysAboveTarget > 0 && (
					<span>{summary.daysAboveTarget} days above target</span>
				)}
			</div>

			{summary.needsBalancing && (
				<div class="ep:mt-2 ep:text-xs ep:text-obs-orange ep:bg-obs-orange/10 ep:px-2.5 ep:py-1.5 ep:rounded">
					Workload is uneven — consider using Load Balance to smooth reviews
				</div>
			)}

			{dayOfWeek.length > 0 && (
				<div class="ep:mt-4">
					<p class="ep:text-xs ep:font-medium ep:text-obs-muted ep:mb-2">
						Average by day of week
					</p>
					<div class="ep:h-24">
						<canvas ref={dowCanvasRef} />
					</div>
				</div>
			)}
		</ChartCard>
	);
}

function formatLabel(date: string): string {
	const d = new Date(date);
	return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatShortDate(date: string): string {
	if (!date) return "—";
	const d = new Date(date);
	return `${d.getMonth() + 1}/${d.getDate()}`;
}
