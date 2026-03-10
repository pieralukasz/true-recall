import type {
	TrueRetentionEntry,
	TrueRetentionSummary,
} from "@features/metrics/services/fsrs-tools/statistics/true-retention.calculator";
import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";
import { CHART_COLORS, withAlpha } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";

interface TrueRetentionCardProps {
	summary: TrueRetentionSummary;
	history: TrueRetentionEntry[];
}

export function TrueRetentionCard({
	summary,
	history,
}: TrueRetentionCardProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const targetPct = Math.round(summary.target * 100);
	const currentPct = Math.round(summary.current * 100);
	const avgPct = Math.round(summary.average * 100);

	useChart(
		canvasRef,
		(): ChartConfiguration<"line"> | null => {
			if (history.length === 0) return null;
			const labels = history.map((e) => formatLabel(e.date));
			return {
				type: "line",
				data: {
					labels,
					datasets: [
						{
							label: "True Retention",
							data: history.map((e) => Math.round(e.retention * 100)),
							borderColor: CHART_COLORS.green(),
							backgroundColor: withAlpha(CHART_COLORS.green(), 0.1),
							fill: true,
							tension: 0.3,
							pointRadius: 0,
							pointHitRadius: 8,
							borderWidth: 2,
						},
						{
							label: "Target",
							data: history.map(() => targetPct),
							borderColor: withAlpha(CHART_COLORS.muted(), 0.6),
							borderDash: [6, 4],
							borderWidth: 1.5,
							pointRadius: 0,
							pointHitRadius: 0,
							fill: false,
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
								title: (items) =>
									history[items[0]?.dataIndex ?? 0]?.date ?? "",
								label: (item) => `${item.dataset.label}: ${String(item.raw)}%`,
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
								maxTicksLimit: 8,
							},
						},
						y: {
							min: Math.max(0, targetPct - 20),
							max: 100,
							grid: { color: withAlpha(CHART_COLORS.border(), 0.5) },
							ticks: {
								color: CHART_COLORS.muted(),
								callback: (v) => `${String(v)}%`,
							},
						},
					},
				},
			};
		},
		[history, targetPct],
	);

	if (summary.totalReviews === 0) {
		return (
			<ChartCard
				title="True Retention"
				subtitle="Mature card retention (interval >= 21d)"
			>
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">
					Not enough mature card reviews yet
				</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard
			title="True Retention"
			subtitle="Mature card retention (interval >= 21d)"
		>
			<div class="ep:flex ep:items-baseline ep:gap-3 ep:mb-3">
				<span class="ep:text-3xl ep:font-bold ep:text-obs-normal">
					{currentPct}%
				</span>
				<span class="ep:text-xs ep:text-obs-muted">
					Target: {targetPct}%
				</span>
				<TrendBadge trend={summary.trend} />
			</div>

			<div class="ep:h-40">
				<canvas ref={canvasRef} />
			</div>

			<div class="ep:flex ep:gap-4 ep:mt-3 ep:text-xs ep:text-obs-muted">
				<span>Avg: {avgPct}%</span>
				<span>{summary.totalReviews.toLocaleString()} mature reviews</span>
			</div>
		</ChartCard>
	);
}

function TrendBadge({ trend }: { trend: -1 | 0 | 1 }) {
	if (trend === 1) {
		return (
			<span class="ep:text-xs ep:font-medium ep:text-obs-green ep:bg-obs-green/10 ep:px-1.5 ep:py-0.5 ep:rounded">
				Improving
			</span>
		);
	}
	if (trend === -1) {
		return (
			<span class="ep:text-xs ep:font-medium ep:text-obs-orange ep:bg-obs-orange/10 ep:px-1.5 ep:py-0.5 ep:rounded">
				Declining
			</span>
		);
	}
	return (
		<span class="ep:text-xs ep:font-medium ep:text-obs-muted ep:bg-obs-modifier-hover ep:px-1.5 ep:py-0.5 ep:rounded">
			Stable
		</span>
	);
}

function formatLabel(date: string): string {
	const d = new Date(date);
	return `${d.getMonth() + 1}/${d.getDate()}`;
}
