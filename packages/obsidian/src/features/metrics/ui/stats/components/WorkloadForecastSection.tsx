import type { Signal } from "@preact/signals";
import type { ChartConfiguration, ChartDataset } from "chart.js";
import { useRef } from "preact/hooks";

import type { ForecastRange } from "@true-recall/core/metrics/forecast-filter";
import type {
	WorkloadForecastEntry,
	WorkloadForecastSummary,
} from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";

import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";

import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../helpers/use-chart";
import { ChartCard } from "./ChartCard";

const FORECAST_RANGES: { value: ForecastRange; label: string }[] = [
	{ value: "1m", label: "1M" },
	{ value: "3m", label: "3M" },
	{ value: "1y", label: "1Y" },
	{ value: "all", label: "All" },
];

interface WorkloadForecastSectionProps {
	forecast: WorkloadForecastEntry[];
	summary: WorkloadForecastSummary;
	dayOfWeek: { day: number; dayName: string; avgCount: number }[];
	/** When provided, renders a 1M/3M/1Y/All range picker bound to this signal. */
	range?: Signal<ForecastRange>;
}

export function WorkloadForecastSection({
	forecast,
	summary,
	dayOfWeek,
	range,
}: WorkloadForecastSectionProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const dowCanvasRef = useRef<HTMLCanvasElement>(null);

	useChart(canvasRef, (): ChartConfiguration<"bar"> | null => {
		if (forecast.length === 0) return null;
		const labels = forecast.map((d) => formatLabel(d.date));
		const green = CHART_COLORS.green();
		const lineColor = CHART_COLORS.blue();

		const cumulativeLine: ChartDataset<"line"> = {
			type: "line",
			label: "Cumulative",
			data: forecast.map((d) => d.cumulative),
			borderColor: lineColor,
			backgroundColor: lineColor,
			borderWidth: 1.5,
			pointRadius: 0,
			tension: 0.3,
			yAxisID: "y1",
			order: 0,
		};

		return {
			type: "bar",
			data: {
				labels,
				datasets: [
					{
						label: "Young",
						data: forecast.map((d) => d.breakdown.young),
						backgroundColor: withAlpha(green, 0.4),
						borderRadius: 2,
						stack: "due",
						order: 1,
					},
					{
						label: "Mature",
						data: forecast.map((d) => d.breakdown.mature),
						backgroundColor: withAlpha(green, 0.85),
						borderRadius: 2,
						stack: "due",
						order: 1,
					},
					{
						label: "Learning",
						data: forecast.map((d) => d.breakdown.learning),
						backgroundColor: withAlpha(CHART_COLORS.orange(), 0.7),
						borderRadius: 2,
						stack: "due",
						order: 1,
					},
					{
						// Estimated, not scheduled: faint fill with a solid outline so it
						// reads as a projection next to the counted segments.
						label: "Projected relearning",
						data: forecast.map((d) => d.breakdown.projectedRelearning),
						backgroundColor: withAlpha(CHART_COLORS.orange(), 0.22),
						borderColor: withAlpha(CHART_COLORS.orange(), 0.7),
						borderWidth: 1,
						borderRadius: 2,
						stack: "due",
						order: 1,
					},
					// Mixed chart: line dataset on the secondary axis. Chart.js
					// supports per-dataset `type` at runtime; cast past the bar typing.
					cumulativeLine as unknown as ChartDataset<"bar">,
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: { mode: "index", intersect: false },
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
								const entry = forecast[items[0]?.dataIndex ?? 0];
								return entry ? `Due that day: ${String(entry.dueCount)}` : "";
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
						position: "left",
						grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
						ticks: { color: CHART_COLORS.muted() },
					},
					y1: {
						beginAtZero: true,
						position: "right",
						grid: { drawOnChartArea: false },
						ticks: { color: withAlpha(CHART_COLORS.blue(), 0.9) },
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

	const rangePicker = range ? (
		<div class="ep:flex ep:gap-1 ep:bg-obs-secondary ep:rounded-lg ep:p-0.5">
			{FORECAST_RANGES.map((r) => (
				<Clickable
					key={r.value}
					role="tab"
					aria-selected={range.value === r.value}
					class={cn(
						"ep:px-2.5 ep:py-0.5 ep:text-xs ep:font-medium ep:rounded-md ep:transition-colors",
						range.value === r.value
							? "ep:bg-obs-interactive/15 ep:text-obs-interactive"
							: "ep:text-obs-muted ep:hover:text-obs-normal",
					)}
					onClick={() => {
						range.value = r.value;
					}}
				>
					{r.label}
				</Clickable>
			))}
		</div>
	) : undefined;

	if (forecast.length === 0) {
		return (
			<ChartCard
				title="Workload Forecast"
				subtitle="Predicted daily reviews"
				action={rangePicker}
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
			subtitle="Predicted daily reviews"
			action={rangePicker}
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
