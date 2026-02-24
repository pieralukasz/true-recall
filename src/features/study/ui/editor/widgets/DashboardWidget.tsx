import { WorkloadForecastCalculator } from "@features/metrics/services/fsrs-tools/statistics/workload-forecast.calculator";
import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { dataVersion, useSignalVersion } from "@shared/services/signals";
import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";

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

interface GlobalCounts {
	total: number;
	due: number;
	newCount: number;
	learning: number;
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
	const ver = useSignalVersion(dataVersion);

	const data = useMemo(() => {
		if (!plugin.sessionPersistence || !plugin.cardStore) return null;

		const statsCalc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);

		const forecast = new WorkloadForecastCalculator(plugin.cardStore);
		const entries = forecast.getForecast(7);

		const todaySummary = statsCalc.getTodaySummary();
		const streakInfo = statsCalc.getStreakInfo();

		const forecastDays: ForecastDay[] = entries.map((e) => ({
			label: formatDayLabel(new Date(e.date)),
			count: e.dueCount,
			isToday: e.date === new Date().toISOString().split("T")[0],
		}));

		const allCards = plugin.flashcardManager.getAllFSRSCards();
		const now = new Date();
		let due = 0;
		let newCount = 0;
		let learning = 0;

		for (const card of allCards) {
			const fsrs = card.fsrs;
			if (
				fsrs.suspended ||
				(fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
			)
				continue;
			switch (fsrs.state) {
				case 0:
					newCount++;
					break;
				case 1:
				case 3:
					learning++;
					break;
				case 2:
					if (new Date(fsrs.due) <= now) due++;
					break;
			}
		}

		const today: TodayData = {
			studied: todaySummary.studied,
			minutes: todaySummary.minutes,
			correctRate: todaySummary.correctRate,
			streak: streakInfo.current,
		};

		const global: GlobalCounts = {
			total: allCards.length,
			due,
			newCount,
			learning,
		};

		return { today, forecastDays, global };
	}, [plugin, ver]);

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
	const plugin = usePlugin();
	const ver = useSignalVersion(dataVersion);

	const data = useMemo(() => {
		if (!sourceUid || !plugin.cardStore) return null;

		const cards = plugin.cardStore.getCardsBySourceUid(sourceUid);
		if (cards.length === 0) return null;

		const now = new Date();
		let newCount = 0;
		let learning = 0;
		let due = 0;
		let suspended = 0;

		for (const card of cards) {
			if (card.suspended) {
				suspended++;
				continue;
			}
			if (card.buriedUntil && new Date(card.buriedUntil) > now) continue;
			switch (card.state) {
				case 0:
					newCount++;
					break;
				case 1:
				case 3:
					learning++;
					break;
				case 2:
					if (new Date(card.due) <= now) due++;
					break;
			}
		}

		// Get last review date
		let lastReviewed: string | null = null;
		for (const card of cards) {
			if (card.lastReview) {
				if (!lastReviewed || card.lastReview > lastReviewed) {
					lastReviewed = card.lastReview;
				}
			}
		}

		// 7-day forecast for this note
		const forecastDays: ForecastDay[] = [];
		for (let i = 0; i < 7; i++) {
			const date = new Date();
			date.setDate(date.getDate() + i);
			const dateStr = date.toISOString().split("T")[0] ?? "";
			let count = 0;
			for (const card of cards) {
				if (card.suspended) continue;
				const cardDate = new Date(card.due).toISOString().split("T")[0];
				if (cardDate === dateStr) count++;
			}
			forecastDays.push({
				label: formatDayLabel(date),
				count,
				isToday: i === 0,
			});
		}

		return {
			total: cards.length,
			newCount,
			learning,
			due,
			suspended,
			lastReviewed: lastReviewed
				? new Date(lastReviewed).toLocaleDateString()
				: null,
			forecastDays,
		};
	}, [plugin, sourceUid, ver]);

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
