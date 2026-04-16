import { useComputed } from "@preact/signals";
import { useMemo } from "preact/hooks";

import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";

import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact";

import {
	configValue,
	parseCodeblockConfig,
} from "@true-recall/plugins/dashboard-codeblock/config-parser";

interface RatingsData {
	again: number;
	hard: number;
	good: number;
	easy: number;
	total: number;
}

const RATINGS = [
	{ key: "again" as const, label: "Again", color: "var(--color-red)" },
	{ key: "hard" as const, label: "Hard", color: "var(--color-orange)" },
	{ key: "good" as const, label: "Good", color: "var(--color-green)" },
	{ key: "easy" as const, label: "Easy", color: "var(--color-cyan)" },
];

const PERIOD_LABELS: Record<string, string> = {
	today: "Today",
	week: "This Week",
	month: "This Month",
	all: "All Time",
};

function computeRatingsData(
	statsCalc: StatsCalculatorService,
	period: string,
): RatingsData {
	if (period === "today") {
		const allStats = statsCalc.getAllDailyStats();
		const todayKey = new Date().toISOString().split("T")[0] ?? "";
		const todayStats = allStats[todayKey];
		if (!todayStats) return { again: 0, hard: 0, good: 0, easy: 0, total: 0 };
		const again = todayStats.again ?? 0;
		const hard = todayStats.hard ?? 0;
		const good = todayStats.good ?? 0;
		const easy = todayStats.easy ?? 0;
		return { again, hard, good, easy, total: again + hard + good + easy };
	}

	if (period === "week") {
		const allStats = statsCalc.getAllDailyStats();
		const today = new Date();
		let again = 0;
		let hard = 0;
		let good = 0;
		let easy = 0;
		for (let i = 0; i < 7; i++) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const key = d.toISOString().split("T")[0] ?? "";
			const entry = allStats[key];
			if (entry) {
				again += entry.again ?? 0;
				hard += entry.hard ?? 0;
				good += entry.good ?? 0;
				easy += entry.easy ?? 0;
			}
		}
		return { again, hard, good, easy, total: again + hard + good + easy };
	}

	// "month" -> "1m", "all" -> "all"
	const range = period === "month" ? "1m" : "all";
	const entries = statsCalc.getRatingDistributionHistory(range);
	let again = 0;
	let hard = 0;
	let good = 0;
	let easy = 0;
	for (const entry of entries) {
		again += entry.again;
		hard += entry.hard;
		good += entry.good;
		easy += entry.easy;
	}
	return { again, hard, good, easy, total: again + hard + good + easy };
}

function formatPct(count: number, total: number): string {
	if (total === 0) return "0%";
	return `${Math.round((count / total) * 100)}%`;
}

// SVG donut chart constants
const DONUT_SIZE = 100;
const DONUT_RADIUS = 38;
const DONUT_STROKE = 12;
const DONUT_CENTER = DONUT_SIZE / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function BarChart({ data }: { data: RatingsData }) {
	const maxCount = Math.max(1, data.again, data.hard, data.good, data.easy);

	return (
		<div class="ep:flex ep:flex-col ep:gap-1.5">
			{RATINGS.map((r) => {
				const count = data[r.key];
				const pct = (count / maxCount) * 100;
				return (
					<div key={r.key} class="ep:flex ep:items-center ep:gap-2 ep:text-xs">
						<span class="ep:w-10 ep:text-obs-muted ep:shrink-0">{r.label}</span>
						<div class="ep:flex-1 ep:h-4 ep:rounded ep:bg-obs-modifier-hover ep:overflow-hidden">
							<div
								class="ep:h-full ep:rounded ep:transition-all"
								style={{
									width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
									backgroundColor: r.color,
								}}
							/>
						</div>
						<span class="ep:w-16 ep:text-right ep:tabular-nums ep:shrink-0">
							{count} ({formatPct(count, data.total)})
						</span>
					</div>
				);
			})}
		</div>
	);
}

function DonutChart({ data }: { data: RatingsData }) {
	const segments: {
		color: string;
		pct: number;
		key: string;
		label: string;
		count: number;
	}[] = [];

	for (const r of RATINGS) {
		const count = data[r.key];
		const pct = data.total > 0 ? (count / data.total) * 100 : 0;
		segments.push({ color: r.color, pct, key: r.key, label: r.label, count });
	}

	let offset = 0;

	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:gap-2">
			<svg
				viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
				class="ep:w-24 ep:h-24"
				aria-hidden="true"
			>
				{/* Background circle */}
				<circle
					cx={DONUT_CENTER}
					cy={DONUT_CENTER}
					r={DONUT_RADIUS}
					fill="none"
					stroke="var(--background-modifier-hover)"
					stroke-width={DONUT_STROKE}
				/>
				{segments.map((seg) => {
					if (seg.pct === 0) return null;
					const segmentLength = DONUT_CIRCUMFERENCE * (seg.pct / 100);
					const dashOffset = -offset;
					offset += segmentLength;
					return (
						<circle
							key={seg.key}
							cx={DONUT_CENTER}
							cy={DONUT_CENTER}
							r={DONUT_RADIUS}
							fill="none"
							stroke={seg.color}
							stroke-width={DONUT_STROKE}
							stroke-dasharray={`${segmentLength} ${DONUT_CIRCUMFERENCE - segmentLength}`}
							stroke-dashoffset={dashOffset}
							stroke-linecap="butt"
							transform={`rotate(-90 ${DONUT_CENTER} ${DONUT_CENTER})`}
						/>
					);
				})}
				{/* Center text */}
				<text
					x={DONUT_CENTER}
					y={DONUT_CENTER}
					text-anchor="middle"
					dominant-baseline="central"
					class="ep:text-xs ep:font-semibold"
					fill="var(--text-normal)"
				>
					{data.total}
				</text>
			</svg>

			{/* Legend */}
			<div class="ep:flex ep:flex-wrap ep:justify-center ep:gap-x-3 ep:gap-y-1 ep:text-xs">
				{segments.map((seg) => (
					<div key={seg.key} class="ep:flex ep:items-center ep:gap-1">
						<span
							class="ep:w-2 ep:h-2 ep:rounded-full ep:shrink-0"
							style={{ backgroundColor: seg.color }}
						/>
						<span class="ep:text-obs-muted">
							{seg.label} {seg.count}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

export function RatingsWidget({ source }: { source: string }) {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useComputed((): RatingsData | null => {
		void allMeta.value;
		if (!plugin.sessionPersistence) return null;

		const statsCalc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);

		const period = configValue(config, "period", "week");
		return computeRatingsData(statsCalc, String(period));
	}).value;

	if (!data) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	const period = String(configValue(config, "period", "week"));
	const style = String(configValue(config, "style", "bar"));
	const periodLabel = PERIOD_LABELS[period] ?? "This Week";

	if (data.total === 0) {
		return (
			<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
				<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
					<span class="ep:text-obs-muted">{periodLabel}</span>
				</div>
				<div class="ep:text-obs-muted ep:text-xs">
					No reviews in this period
				</div>
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
				<span class="ep:text-obs-muted">{periodLabel}</span>
			</div>

			{style === "donut" ? (
				<DonutChart data={data} />
			) : (
				<BarChart data={data} />
			)}
		</div>
	);
}
