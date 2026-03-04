import { useComputed } from "@preact/signals";
import { cards } from "@shared/services/reactive-card-store";
import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";

const TREND_ARROWS: Record<number, { symbol: string; color: string }> = {
	1: { symbol: "\u2191", color: "var(--color-green)" },
	0: { symbol: "\u2192", color: "var(--text-muted)" },
	[-1]: { symbol: "\u2193", color: "var(--color-red)" },
};

export function TrueRetentionWidget({ source }: { source: string }) {
	const plugin = usePlugin();

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const days = configValue(config, "days", 30) as number;
	const showSparkline = configValue(config, "showSparkline", true);
	const showTarget = configValue(config, "showTarget", true);

	const data = useComputed(() => {
		cards.value;
		if (!plugin.fsrsHelper) return null;

		const summary = plugin.fsrsHelper.getTrueRetentionSummary(days);
		const history = showSparkline
			? plugin.fsrsHelper.getTrueRetentionHistory(days)
			: [];

		return { summary, history };
	}).value;

	if (!plugin.fsrsHelper) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>
		);
	}

	if (!data || data.summary.totalReviews === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				Review more cards to see true retention
			</div>
		);
	}

	const { summary, history } = data;
	const currentPct = Math.round(summary.current * 100);
	const targetPct = Math.round(summary.target * 100);
	const diff = currentPct - targetPct;

	const retentionColor =
		diff >= 0
			? "var(--color-green)"
			: diff >= -5
				? "var(--color-orange)"
				: "var(--color-red)";

	const trend = TREND_ARROWS[summary.trend] ?? TREND_ARROWS[0]!;

	const handleClick = () => {
		plugin.openStatsView().catch(() => {});
	};

	return (
		<Clickable
			class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm"
			onClick={handleClick}
			title="Open statistics"
		>
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
				<span class="ep:font-semibold">True Retention</span>
				{showTarget && (
					<span class="ep:text-obs-muted">target: {targetPct}%</span>
				)}
			</div>

			{/* Main metric */}
			<div class="ep:flex ep:items-baseline ep:gap-2">
				<span
					class="ep:text-2xl ep:font-bold ep:leading-none"
					style={{ color: retentionColor }}
				>
					{currentPct}%
				</span>
				<span
					class="ep:text-sm ep:font-semibold"
					style={{ color: trend.color }}
				>
					{trend.symbol}
				</span>
				<span class="ep:text-xs ep:text-obs-muted ep:ml-auto">
					avg {Math.round(summary.average * 100)}%
				</span>
			</div>

			{/* Sparkline */}
			{showSparkline && history.length > 1 && (
				<Sparkline
					data={history.map((h) => h.retention)}
					target={summary.target}
					color={retentionColor}
				/>
			)}

			{/* Footer */}
			<div class="ep:text-xs ep:text-obs-muted">
				{summary.totalReviews} mature reviews in last {days} days
			</div>
		</Clickable>
	);
}

function Sparkline({
	data,
	target,
	color,
}: {
	data: number[];
	target: number;
	color: string;
}) {
	const width = 200;
	const height = 30;
	const padding = 2;

	const min = Math.min(...data, target) - 0.02;
	const max = Math.max(...data, target) + 0.02;
	const range = max - min || 0.01;

	const points = data
		.map((val, i) => {
			const x = padding + (i / (data.length - 1)) * (width - padding * 2);
			const y =
				height - padding - ((val - min) / range) * (height - padding * 2);
			return `${x},${y}`;
		})
		.join(" ");

	const targetY =
		height - padding - ((target - min) / range) * (height - padding * 2);

	return (
		<svg
			width="100%"
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="none"
			class="ep:rounded"
		>
			{/* Target line */}
			<line
				x1={0}
				y1={targetY}
				x2={width}
				y2={targetY}
				stroke="var(--text-muted)"
				stroke-width="0.5"
				stroke-dasharray="4,3"
				opacity="0.5"
			/>
			{/* Data line */}
			<polyline
				points={points}
				fill="none"
				stroke={color}
				stroke-width="1.5"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		</svg>
	);
}
