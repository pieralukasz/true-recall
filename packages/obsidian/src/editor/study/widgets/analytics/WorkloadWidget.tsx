import { useComputed } from "@preact/signals";
import { WorkloadForecastCalculator } from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import { Clickable } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface WorkloadDay {
	label: string;
	count: number;
	estimatedMinutes: number;
	isToday: boolean;
	isHeavy: boolean;
	isLightest: boolean;
	daysAhead: number;
}

interface WorkloadData {
	days: WorkloadDay[];
	avgDaily: number;
	peakDay: { label: string; count: number };
	needsBalancing: boolean;
}

export function WorkloadWidget({ source }: { source: string }) {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useComputed((): WorkloadData | null => {
		void allMeta.value;
		if (!plugin.cardStore || !plugin.sessionPersistence) return null;

		const forecastDays = configValue(config, "days", 14) as number;
		const heavyThreshold = configValue(config, "heavyThreshold", 1.5) as number;
		const overrideMinPerCard = config.minutesPerCard;

		const forecast = new WorkloadForecastCalculator(plugin.cardStore);
		const entries = forecast.getForecast(forecastDays);
		const summary = forecast.getSummary(30, forecastDays);

		// Calculate time per card from recent stats
		const statsCalc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);
		const todaySummary = statsCalc.getTodaySummary();
		const minPerCard =
			typeof overrideMinPerCard === "number"
				? overrideMinPerCard
				: todaySummary.studied > 0
					? todaySummary.minutes / todaySummary.studied
					: 0.5; // default ~30s per card

		const avgDaily = summary.avgDaily;
		const minCount = Math.min(...entries.map((e) => e.dueCount));

		const today = new Date().toISOString().split("T")[0];

		const days: WorkloadDay[] = entries.map((entry, idx) => {
			const entryDate = new Date(entry.date);
			const label =
				entry.date === today ? "Today" : (DAY_NAMES[entryDate.getDay()] ?? "");
			return {
				label,
				count: entry.dueCount,
				estimatedMinutes: Math.round(entry.dueCount * minPerCard),
				isToday: entry.date === today,
				isHeavy: avgDaily > 0 && entry.dueCount > avgDaily * heavyThreshold,
				isLightest: entry.dueCount === minCount && entry.dueCount < avgDaily,
				daysAhead: idx,
			};
		});

		const firstEntry = entries[0];
		if (!firstEntry)
			return {
				days,
				avgDaily: 0,
				peakDay: { label: "", count: 0 },
				needsBalancing: false,
			};
		const peakEntry = entries.reduce(
			(max, e) => (e.dueCount > max.dueCount ? e : max),
			firstEntry,
		);
		const peakDate = new Date(peakEntry.date);
		const peakLabel =
			peakEntry.date === today ? "Today" : (DAY_NAMES[peakDate.getDay()] ?? "");

		return {
			days,
			avgDaily: Math.round(avgDaily),
			peakDay: { label: peakLabel, count: peakEntry.dueCount },
			needsBalancing: summary.needsBalancing,
		};
	}).value;

	if (!data || data.days.length === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">No forecast data.</div>
		);
	}

	const showTime = configValue(config, "showTime", true);
	const showFlags = configValue(config, "showFlags", true);
	const maxCount = Math.max(1, ...data.days.map((d) => d.count));

	const handleTodayReview = () => {
		plugin.openCustomStudyModal().catch(() => {});
	};

	const handleDayClick = (daysAhead: number) => {
		if (daysAhead === 0) {
			handleTodayReview();
			return;
		}
		plugin
			.openReviewViewWithFilters({
				studyAheadDays: daysAhead,
				ignoreDailyLimits: true,
			})
			.catch(() => {});
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
				<span class="ep:font-semibold">
					Workload Planner ({configValue(config, "days", 14)} days)
				</span>
				<span class="ep:text-obs-muted">avg: {data.avgDaily} cards/day</span>
			</div>

			{/* Day rows */}
			<div class="ep:flex ep:flex-col ep:gap-1">
				{data.days.map((day) => (
					<Clickable
						key={`${day.label}-${day.daysAhead}`}
						class="ep:flex ep:items-center ep:gap-2 ep:text-xs hover:ep:bg-obs-modifier-hover ep:rounded ep:px-1 ep:py-0.5"
						onClick={() => handleDayClick(day.daysAhead)}
						title={
							day.isToday
								? "Start review"
								: `Study ahead: ${day.daysAhead} days`
						}
					>
						<span
							class={`ep:w-10 ep:text-right ${day.isToday ? "ep:font-semibold" : "ep:text-obs-muted"}`}
						>
							{day.label}
						</span>
						<div class="ep:flex-1 ep:h-3 ep:rounded ep:bg-obs-modifier-hover ep:overflow-hidden">
							{day.count > 0 && (
								<div
									class="ep:h-full ep:rounded"
									style={{
										width: `${(day.count / maxCount) * 100}%`,
										backgroundColor: day.isHeavy
											? "var(--color-orange)"
											: "var(--color-blue)",
										opacity: day.isToday ? 1 : 0.7,
									}}
								/>
							)}
						</div>
						<span
							class={`ep:w-6 ep:text-right ${day.count > 0 ? "" : "ep:text-obs-muted"}`}
						>
							{day.count}
						</span>
						{showTime && (
							<span class="ep:w-10 ep:text-right ep:text-obs-muted">
								~{day.estimatedMinutes}m
							</span>
						)}
						{showFlags && day.isToday && day.count > 0 && (
							<span class="ep:text-obs-accent ep:font-semibold ep:w-16 ep:text-right">
								Review →
							</span>
						)}
						{showFlags && !day.isToday && day.isHeavy && (
							<span
								class="ep:w-16 ep:text-right"
								style={{ color: "var(--color-orange)" }}
							>
								heavy
							</span>
						)}
						{showFlags && !day.isToday && day.isLightest && !day.isHeavy && (
							<span class="ep:w-16 ep:text-right ep:text-obs-muted">
								lightest
							</span>
						)}
						{showFlags && !day.isToday && !day.isHeavy && !day.isLightest && (
							<span class="ep:w-16" />
						)}
					</Clickable>
				))}
			</div>

			{/* Summary footer */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:text-xs ep:text-obs-muted ep:pt-1 ep:border-t ep:border-obs-modifier-border">
				<span>
					Peak: {data.peakDay.label} ({data.peakDay.count})
				</span>
				{data.needsBalancing && (
					<>
						<span style={{ opacity: 0.4 }}>│</span>
						<span style={{ color: "var(--color-orange)" }}>
							Balance: needs attention
						</span>
					</>
				)}
			</div>
		</div>
	);
}
