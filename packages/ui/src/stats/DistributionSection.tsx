import { useSignal } from "@preact/signals";
import type {
	DistributionStats,
	HistogramBucket,
} from "@true-recall/core/metrics/fsrs-tools/statistics/distribution.calculator";
import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";
import { Clickable } from "../shared/Clickable";
import { cn } from "../utils/cn";
import { ChartCard } from "./ChartCard";
import { CHART_COLORS, withAlpha } from "./chart-theme";
import { useChart } from "./use-chart";

type DistTab = "interval" | "stability" | "difficulty";

interface DistributionSectionProps {
	data: {
		interval: { histogram: HistogramBucket[]; stats: DistributionStats };
		stability: { histogram: HistogramBucket[]; stats: DistributionStats };
		difficulty: { histogram: HistogramBucket[]; stats: DistributionStats };
	} | null;
}

const TABS: { value: DistTab; label: string }[] = [
	{ value: "interval", label: "Intervals" },
	{ value: "stability", label: "Stability" },
	{ value: "difficulty", label: "Difficulty" },
];

export function DistributionSection({ data }: DistributionSectionProps) {
	const activeTab = useSignal<DistTab>("interval");

	if (!data) {
		return (
			<ChartCard title="FSRS Distributions">
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">
					No data available
				</p>
			</ChartCard>
		);
	}

	const current = data[activeTab.value];

	return (
		<ChartCard title="FSRS Distributions">
			<div class="ep:flex ep:gap-1 ep:mb-3">
				{TABS.map((tab) => (
					<Clickable
						key={tab.value}
						role="tab"
						aria-selected={activeTab.value === tab.value}
						class={cn(
							"ep:px-2.5 ep:py-1 ep:text-xs ep:font-medium ep:rounded-md ep:transition-colors",
							activeTab.value === tab.value
								? "ep:bg-obs-interactive/15 ep:text-obs-interactive"
								: "ep:text-obs-muted ep:hover:text-obs-normal",
						)}
						onClick={() => {
							activeTab.value = tab.value;
						}}
					>
						{tab.label}
					</Clickable>
				))}
			</div>
			<DistHistogram
				histogram={current.histogram}
				stats={current.stats}
				tab={activeTab.value}
			/>
		</ChartCard>
	);
}

function DistHistogram({
	histogram,
	stats,
	tab,
}: {
	histogram: HistogramBucket[];
	stats: DistributionStats;
	tab: DistTab;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useChart(canvasRef, (): ChartConfiguration<"bar"> | null => {
		if (histogram.length === 0) return null;
		return {
			type: "bar",
			data: {
				labels: histogram.map((b) => b.label),
				datasets: [
					{
						label: "Cards",
						data: histogram.map((b) => b.count),
						backgroundColor: withAlpha(CHART_COLORS.purple(), 0.7),
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
							label: (ctx) => {
								const bucket = histogram[ctx.dataIndex];
								return `${ctx.parsed.y} cards (${bucket?.percentage.toFixed(1)}%)`;
							},
						},
					},
				},
				scales: {
					x: {
						grid: { display: false },
						ticks: { color: CHART_COLORS.muted(), font: { size: 10 } },
					},
					y: {
						beginAtZero: true,
						grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
						ticks: { color: CHART_COLORS.muted() },
					},
				},
			},
		};
	}, [histogram, tab]);

	if (histogram.length === 0) {
		return (
			<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">No data</p>
		);
	}

	return (
		<div>
			<div class="ep:h-40">
				<canvas ref={canvasRef} />
			</div>
			<div class="ep:flex ep:gap-4 ep:mt-2 ep:text-xs ep:text-obs-muted">
				<span>Mean: {stats.mean}</span>
				<span>Median: {stats.median}</span>
				<span>Std Dev: {stats.stdDev}</span>
				<span>Count: {stats.count}</span>
			</div>
		</div>
	);
}
