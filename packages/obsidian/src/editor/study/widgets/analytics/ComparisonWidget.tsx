import { useComputed } from "@preact/signals";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import type { ExtendedDailyStats } from "@true-recall/core/types/fsrs/stats.types";
import { Clickable } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";

interface PeriodMetrics {
	reviewed: number;
	correctRate: number;
	timeMinutes: number;
	newCards: number;
	avgDifficulty: number;
}

interface ComparisonData {
	current: PeriodMetrics;
	previous: PeriodMetrics;
	streak: { current: number; longest: number };
	periodLabel: string;
}

export function ComparisonWidget({ source }: { source: string }) {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useComputed((): ComparisonData | null => {
		void allMeta.value;
		if (!plugin.sessionPersistence) return null;

		const statsCalc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);

		const period = configValue(config, "period", "week") as string;
		const allStats = statsCalc.getAllDailyStats();
		const today = new Date();

		let currentStart: Date;
		let previousStart: Date;
		let previousEnd: Date;
		let periodLabel: string;

		if (period === "month") {
			currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
			previousEnd = new Date(currentStart);
			previousEnd.setDate(previousEnd.getDate() - 1);
			previousStart = new Date(
				previousEnd.getFullYear(),
				previousEnd.getMonth(),
				1,
			);
			periodLabel = "This Month vs Last Month";
		} else {
			// week (default)
			const dayOfWeek = today.getDay();
			const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
			currentStart = new Date(today);
			currentStart.setDate(today.getDate() - mondayOffset);
			previousEnd = new Date(currentStart);
			previousEnd.setDate(previousEnd.getDate() - 1);
			previousStart = new Date(previousEnd);
			previousStart.setDate(previousEnd.getDate() - 6);
			periodLabel = "This Week vs Last Week";
		}

		const current = aggregatePeriod(allStats, currentStart, today);
		const previous = aggregatePeriod(allStats, previousStart, previousEnd);
		const streak = statsCalc.getStreakInfo();

		return { current, previous, streak, periodLabel };
	}).value;

	if (!data) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	const showStreak = configValue(config, "showStreak", true);

	const handleClick = () => {
		plugin.openCustomStudyModal().catch(() => {});
	};

	const rows: {
		label: string;
		current: string;
		previous: string;
		change: string;
		improved: boolean;
	}[] = [
		{
			label: "Reviewed",
			current: String(data.current.reviewed),
			previous: String(data.previous.reviewed),
			...formatDelta(data.current.reviewed, data.previous.reviewed, "pct"),
		},
		{
			label: "Correct rate",
			current: `${Math.round(data.current.correctRate * 100)}%`,
			previous: `${Math.round(data.previous.correctRate * 100)}%`,
			...formatDelta(
				data.current.correctRate * 100,
				data.previous.correctRate * 100,
				"pp",
			),
		},
		{
			label: "Time spent",
			current: `${data.current.timeMinutes}m`,
			previous: `${data.previous.timeMinutes}m`,
			// Less time is neutral, not necessarily bad
			...formatDelta(
				data.current.timeMinutes,
				data.previous.timeMinutes,
				"pct",
			),
		},
		{
			label: "New cards",
			current: String(data.current.newCards),
			previous: String(data.previous.newCards),
			...formatDelta(data.current.newCards, data.previous.newCards, "pct"),
		},
	];

	return (
		<Clickable
			class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm"
			onClick={handleClick}
			title="Start a study session"
		>
			{/* Header */}
			<div class="ep:text-xs ep:font-semibold">{data.periodLabel}</div>

			{/* Comparison table */}
			<div class="ep:flex ep:flex-col ep:gap-1">
				{/* Header row */}
				<div class="ep:flex ep:items-center ep:text-xs ep:text-obs-muted ep:gap-2">
					<span class="ep:flex-1" />
					<span class="ep:w-16 ep:text-right">Current</span>
					<span class="ep:w-16 ep:text-right">Previous</span>
					<span class="ep:w-16 ep:text-right">Change</span>
				</div>

				{rows.map((row) => (
					<div
						key={row.label}
						class="ep:flex ep:items-center ep:text-xs ep:gap-2"
					>
						<span class="ep:flex-1">{row.label}</span>
						<span class="ep:w-16 ep:text-right ep:font-semibold">
							{row.current}
						</span>
						<span class="ep:w-16 ep:text-right ep:text-obs-muted">
							{row.previous}
						</span>
						<span
							class="ep:w-16 ep:text-right"
							style={{
								color: row.improved ? "var(--color-green)" : "var(--color-red)",
							}}
						>
							{row.change}
						</span>
					</div>
				))}
			</div>

			{/* Streak */}
			{showStreak && data.streak.current > 0 && (
				<div class="ep:text-xs ep:text-obs-muted ep:pt-1 ep:border-t ep:border-obs-modifier-border">
					Streak: {data.streak.current}d
					{data.streak.longest > data.streak.current &&
						` (longest: ${data.streak.longest}d)`}
				</div>
			)}
		</Clickable>
	);
}

function aggregatePeriod(
	allStats: Record<string, ExtendedDailyStats>,
	start: Date,
	end: Date,
): PeriodMetrics {
	let reviewed = 0;
	let totalCorrect = 0;
	let totalRatings = 0;
	let timeMs = 0;
	let newCards = 0;

	const cursor = new Date(start);
	while (cursor <= end) {
		const key = cursor.toISOString().split("T")[0] ?? "";
		const stats = allStats[key];
		if (stats) {
			reviewed += stats.reviewsCompleted;
			const dayRatings =
				(stats.again ?? 0) +
				(stats.hard ?? 0) +
				(stats.good ?? 0) +
				(stats.easy ?? 0);
			totalCorrect += (stats.good ?? 0) + (stats.easy ?? 0);
			totalRatings += dayRatings;
			timeMs += stats.totalTimeMs;
			newCards += stats.newCards ?? 0;
		}
		cursor.setDate(cursor.getDate() + 1);
	}

	return {
		reviewed,
		correctRate: totalRatings > 0 ? totalCorrect / totalRatings : 0,
		timeMinutes: Math.round(timeMs / 60000),
		newCards,
		avgDifficulty: 0, // Would need card-level data; omitted for simplicity
	};
}

function formatDelta(
	current: number,
	previous: number,
	mode: "pct" | "pp",
): { change: string; improved: boolean } {
	if (previous === 0 && current === 0) return { change: "—", improved: true };
	if (previous === 0) return { change: "+∞", improved: true };

	if (mode === "pp") {
		const diff = current - previous;
		const sign = diff >= 0 ? "+" : "";
		return {
			change: `${sign}${Math.round(diff)}pp ${diff >= 0 ? "↑" : "↓"}`,
			improved: diff >= 0,
		};
	}

	const pct = ((current - previous) / previous) * 100;
	const sign = pct >= 0 ? "+" : "";
	return {
		change: `${sign}${Math.round(pct)}% ${pct >= 0 ? "↑" : "↓"}`,
		improved: pct >= 0,
	};
}
