import { useComputed } from "@preact/signals";
import { cards } from "@shared/services/reactive-card-store";
import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateLabel(dateStr: string): string {
	const d = new Date(dateStr);
	return DAY_NAMES[d.getDay()] ?? "";
}

export function ForecastWidget({ source }: { source: string }) {
	const plugin = usePlugin();

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const days = configValue(config, "days", 14) as number;
	const showChart = configValue(config, "showChart", true);

	const data = useComputed(() => {
		cards.value;
		if (!plugin.fsrsHelper) return null;

		const summary = plugin.fsrsHelper.getWorkloadForecastSummary(days);
		const entries = showChart
			? plugin.fsrsHelper.getWorkloadForecast(days)
			: [];

		return { summary, entries };
	}).value;

	if (!plugin.fsrsHelper) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	if (!data || data.summary.avgDaily === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">No upcoming reviews</div>
		);
	}

	const { summary, entries } = data;

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
				<span class="ep:font-semibold">Forecast ({days}d)</span>
				<span class="ep:text-obs-muted">
					{Math.round(summary.avgDaily)} cards/day avg
				</span>
			</div>

			{/* Stats grid */}
			<div class="ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1 ep:text-xs">
				<StatCell
					label="Peak"
					value={`${formatDateLabel(summary.peakDay.date)} (${summary.peakDay.count})`}
					highlight={summary.peakDay.count > summary.avgDaily * 1.5}
				/>
				<StatCell
					label="Lightest"
					value={`${formatDateLabel(summary.minDay.date)} (${summary.minDay.count})`}
				/>
				<StatCell label="Above avg" value={`${summary.daysAboveTarget} days`} />
				<StatCell
					label="Balance"
					value={summary.needsBalancing ? "Needs attention" : "OK"}
					color={
						summary.needsBalancing
							? "var(--color-orange)"
							: "var(--color-green)"
					}
				/>
			</div>

			{/* Mini bar chart */}
			{showChart && entries.length > 0 && (
				<MiniBarChart entries={entries} avgDaily={summary.avgDaily} />
			)}
		</Clickable>
	);
}

function StatCell({
	label,
	value,
	color,
	highlight,
}: {
	label: string;
	value: string;
	color?: string;
	highlight?: boolean;
}) {
	return (
		<div class="ep:flex ep:items-center ep:justify-between">
			<span class="ep:text-obs-muted">{label}</span>
			<span
				class={highlight ? "ep:font-medium" : ""}
				style={color ? { color } : undefined}
			>
				{value}
			</span>
		</div>
	);
}

function MiniBarChart({
	entries,
	avgDaily,
}: {
	entries: { date: string; dueCount: number }[];
	avgDaily: number;
}) {
	const maxCount = Math.max(1, ...entries.map((e) => e.dueCount));
	const chartHeight = 24;
	const barWidth = 3;
	const gap = 1;
	const totalWidth = entries.length * (barWidth + gap) - gap;

	const today = new Date().toISOString().split("T")[0];

	return (
		<div class="ep:flex ep:flex-col ep:gap-1 ep:pt-1 ep:border-t ep:border-obs-modifier-border">
			<svg
				width="100%"
				height={chartHeight}
				viewBox={`0 0 ${totalWidth} ${chartHeight}`}
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				{entries.map((entry, i) => {
					const barH =
						maxCount > 0
							? Math.max(1, (entry.dueCount / maxCount) * chartHeight)
							: 1;
					const isToday = entry.date === today;
					const isHeavy = entry.dueCount > avgDaily * 1.5;

					let fill: string;
					if (isToday) fill = "var(--interactive-accent)";
					else if (isHeavy) fill = "var(--color-orange)";
					else fill = "var(--color-blue)";

					return (
						<rect
							key={entry.date}
							x={i * (barWidth + gap)}
							y={chartHeight - barH}
							width={barWidth}
							height={barH}
							rx="1"
							fill={fill}
							opacity={isToday ? 1 : 0.7}
						/>
					);
				})}
			</svg>
		</div>
	);
}
