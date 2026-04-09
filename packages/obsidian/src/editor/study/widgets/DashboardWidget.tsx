import { useMemo } from "preact/hooks";
import { State } from "ts-fsrs";

import { WorkloadForecastCalculator } from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";

import { type GlobalCounts, Q, useQuery } from "@true-recall/obsidian/data";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { usePlugin } from "@true-recall/obsidian/preact";

interface TodayData {
	studied: number;
	minutes: number;
	correctRate: number;
	streak: number;
}

interface ForecastDay {
	label: string;
	count: number;
	isToday: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDayLabel(date: Date): string {
	const today = new Date();
	const todayStr = today.toISOString().split("T")[0];
	const dateStr = date.toISOString().split("T")[0];
	if (dateStr === todayStr) return "Today";
	return DAY_NAMES[date.getDay()] ?? "";
}

export function DashboardWidget() {
	const plugin = usePlugin();
	const globalCountsSignal = useQuery<GlobalCounts>(Q.GLOBAL_COUNTS);
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);

	// Subscribe to reactive data changes
	const _cards = allMeta.value;
	const counts = globalCountsSignal.value;

	// Cache service instances — avoid re-creating on every render
	const { statsCalc, forecast } = useMemo(() => {
		const calc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);
		calc.setDayStartHour(plugin.settings.dayStartHour);
		return {
			statsCalc: calc,
			forecast: new WorkloadForecastCalculator(plugin.cardStore),
		};
	}, [plugin]);

	const data = useMemo(() => {
		if (!plugin.sessionPersistence || !plugin.cardStore) return null;

		const entries = forecast.getForecast(7);
		const todaySummary = statsCalc.getTodaySummary();
		const streakInfo = statsCalc.getStreakInfo();

		const forecastDays: ForecastDay[] = entries.map((e) => ({
			label: formatDayLabel(new Date(e.date)),
			count: e.dueCount,
			isToday: e.date === new Date().toISOString().split("T")[0],
		}));

		const today: TodayData = {
			studied: todaySummary.studied,
			minutes: todaySummary.minutes,
			correctRate: todaySummary.correctRate,
			streak: streakInfo.current,
		};

		const global = {
			total: counts.total,
			due: counts.due,
			newCount: counts.newCount,
			learning: counts.learning,
		};

		return { today, forecastDays, global };
	}, [_cards, counts, plugin, statsCalc, forecast]);

	if (!data) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	const maxCount = Math.max(1, ...data.forecastDays.map((d) => d.count));

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:text-sm">
			{/* Today row */}
			<div class="ep:flex ep:items-center ep:gap-3 ep:flex-wrap ep:text-xs">
				{data.today.studied > 0 && <span>{data.today.studied} studied</span>}
				{data.today.minutes > 0 && <span>{data.today.minutes}m</span>}
				{data.today.correctRate > 0 && (
					<span>{Math.round(data.today.correctRate * 100)}%</span>
				)}
				{data.today.streak > 0 && <span>{data.today.streak}d streak</span>}
				{data.today.studied === 0 && data.today.streak === 0 && (
					<span class="ep:text-obs-muted">No reviews today</span>
				)}
			</div>

			{/* 7-day forecast bars */}
			{data.forecastDays.length > 0 && (
				<div class="ep:flex ep:flex-col ep:gap-1">
					<div class="ep:text-xs ep:text-obs-muted ep:mb-0.5">This week</div>
					{data.forecastDays.map((day) => (
						<div
							key={day.label}
							class="ep:flex ep:items-center ep:gap-2 ep:text-xs"
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
											backgroundColor: `var(${FSRS_COLORS.review.cssVar})`,
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
						</div>
					))}
				</div>
			)}

			{/* Global counts */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:text-xs ep:flex-wrap ep:pt-1 ep:border-t ep:border-obs-modifier-border">
				<span>{data.global.total} total</span>
				<span style={{ opacity: 0.4 }}>·</span>
				<span style={{ color: `var(${FSRS_COLORS.review.cssVar})` }}>
					{data.global.due} due
				</span>
				<span style={{ opacity: 0.4 }}>·</span>
				<span style={{ color: `var(${FSRS_COLORS.new.cssVar})` }}>
					{data.global.newCount} new
				</span>
				<span style={{ opacity: 0.4 }}>·</span>
				<span style={{ color: `var(${FSRS_COLORS.learning.cssVar})` }}>
					{data.global.learning} learning
				</span>
			</div>
		</div>
	);
}

export function NoteStatsWidget({ sourceUid }: { sourceUid: string | null }) {
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);
	const cardsBySource = useQuery<Map<string, CardSchedulingMeta[]>>(
		Q.CARDS_BY_SOURCE,
	);
	// Subscribe to reactive data changes
	const _cards = allMeta.value;
	const bySourceUid = cardsBySource.value;

	const data = useMemo(() => {
		if (!sourceUid) return null;

		const noteCards = bySourceUid.get(sourceUid) ?? [];
		if (noteCards.length === 0) return null;

		const now = new Date();
		let newCount = 0;
		let learning = 0;
		let due = 0;
		let suspended = 0;

		for (const card of noteCards) {
			const fsrs = card.fsrs;
			if (fsrs.suspended) {
				suspended++;
				continue;
			}
			if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now) continue;
			switch (fsrs.state) {
				case State.New:
					newCount++;
					break;
				case State.Learning:
				case State.Relearning:
					learning++;
					break;
				case State.Review:
					if (new Date(fsrs.due) <= now) due++;
					break;
			}
		}

		let lastReviewed: string | null = null;
		for (const card of noteCards) {
			const fsrs = card.fsrs;
			if (fsrs.lastReview) {
				if (!lastReviewed || fsrs.lastReview > lastReviewed) {
					lastReviewed = fsrs.lastReview;
				}
			}
		}

		const forecastDays: ForecastDay[] = [];
		for (let i = 0; i < 7; i++) {
			const date = new Date();
			date.setDate(date.getDate() + i);
			const dateStr = date.toISOString().split("T")[0] ?? "";
			let count = 0;
			for (const card of noteCards) {
				if (card.fsrs.suspended) continue;
				const cardDate = new Date(card.fsrs.due).toISOString().split("T")[0];
				if (cardDate === dateStr) count++;
			}
			forecastDays.push({
				label: formatDayLabel(date),
				count,
				isToday: i === 0,
			});
		}

		return {
			total: noteCards.length,
			newCount,
			learning,
			due,
			suspended,
			lastReviewed: lastReviewed
				? new Date(lastReviewed).toLocaleDateString()
				: null,
			forecastDays,
		};
	}, [_cards, bySourceUid, sourceUid]);

	if (!data) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				No flashcards found in this note.
			</div>
		);
	}

	const maxCount = Math.max(1, ...data.forecastDays.map((d) => d.count));

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:text-sm">
			{/* Summary row */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:text-xs ep:flex-wrap">
				<span>{data.total} cards</span>
				<span style={{ opacity: 0.4 }}>·</span>
				<span style={{ color: `var(${FSRS_COLORS.review.cssVar})` }}>
					{data.due} due
				</span>
				<span style={{ opacity: 0.4 }}>·</span>
				<span style={{ color: `var(${FSRS_COLORS.new.cssVar})` }}>
					{data.newCount} new
				</span>
				<span style={{ opacity: 0.4 }}>·</span>
				<span style={{ color: `var(${FSRS_COLORS.learning.cssVar})` }}>
					{data.learning} learning
				</span>
				{data.suspended > 0 && (
					<>
						<span style={{ opacity: 0.4 }}>·</span>
						<span style={{ color: `var(${FSRS_COLORS.suspended.cssVar})` }}>
							{data.suspended} suspended
						</span>
					</>
				)}
			</div>

			{data.lastReviewed && (
				<div class="ep:text-xs ep:text-obs-muted">
					Last reviewed: {data.lastReviewed}
				</div>
			)}

			{/* 7-day forecast */}
			{data.forecastDays.some((d) => d.count > 0) && (
				<div class="ep:flex ep:flex-col ep:gap-1">
					<div class="ep:text-xs ep:text-obs-muted ep:mb-0.5">
						Due this week
					</div>
					{data.forecastDays.map((day) => (
						<div
							key={day.label}
							class="ep:flex ep:items-center ep:gap-2 ep:text-xs"
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
											backgroundColor: `var(${FSRS_COLORS.review.cssVar})`,
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
						</div>
					))}
				</div>
			)}
		</div>
	);
}
