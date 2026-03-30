import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { useComputed } from "@preact/signals";
import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";

interface StreakData {
	current: number;
	longest: number;
	todayCorrectRate: number;
	todayStudied: number;
	weekDots: { label: string; active: boolean; isToday: boolean }[];
}

const SHORT_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function StreakWidget({ source }: { source: string }) {
	const plugin = usePlugin();

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useComputed((): StreakData | null => {
		void cards.value;
		if (!plugin.sessionPersistence) return null;

		const statsCalc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);

		const streakInfo = statsCalc.getStreakInfo();
		const todaySummary = statsCalc.getTodaySummary();
		const allStats = statsCalc.getAllDailyStats();

		// Build week dots (Mon-Sun for current week)
		const today = new Date();
		const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
		// Convert to Mon=0 based
		const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

		const weekDots: StreakData["weekDots"] = [];
		for (let i = 0; i < 7; i++) {
			const date = new Date(today);
			date.setDate(date.getDate() - mondayOffset + i);
			const dateStr = date.toISOString().split("T")[0] ?? "";
			const stats = allStats[dateStr];
			const active = (stats?.reviewsCompleted ?? 0) > 0;
			const isToday = i === mondayOffset;
			weekDots.push({ label: SHORT_DAY_NAMES[i] ?? "", active, isToday });
		}

		return {
			current: streakInfo.current,
			longest: streakInfo.longest,
			todayCorrectRate: todaySummary.correctRate,
			todayStudied: todaySummary.studied,
			weekDots,
		};
	}).value;

	if (!data) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	const showLongest = configValue(config, "showLongest", true);
	const showWeekDots = configValue(config, "showWeekDots", true);
	const showTodayRate = configValue(config, "showTodayRate", true);

	const handleReviewClick = () => {
		plugin.openCustomStudyModal().catch(() => {});
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			{/* Top row: streak + today + action */}
			<div class="ep:flex ep:items-center ep:gap-3 ep:flex-wrap ep:text-xs">
				<span class="ep:font-semibold">{data.current}d streak</span>

				{showLongest && data.longest > 0 && (
					<span class="ep:text-obs-muted">(longest: {data.longest}d)</span>
				)}

				{showTodayRate && data.todayStudied > 0 && (
					<span>{Math.round(data.todayCorrectRate * 100)}% today</span>
				)}

				{showTodayRate && data.todayStudied === 0 && (
					<span class="ep:text-obs-muted">No reviews today</span>
				)}

				<span class="ep:ml-auto">
					<WidgetCta label="Review →" onClick={handleReviewClick} />
				</span>
			</div>

			{/* Week dots */}
			{showWeekDots && (
				<div class="ep:flex ep:items-center ep:gap-3 ep:text-xs">
					{data.weekDots.map((dot) => (
						<div
							key={dot.label}
							class="ep:flex ep:flex-col ep:items-center ep:gap-0.5"
						>
							<span
								class={dot.isToday ? "ep:font-semibold" : "ep:text-obs-muted"}
							>
								{dot.label}
							</span>
							<span
								class={`ep:text-sm ${
									dot.active
										? "ep:text-obs-green"
										: dot.isToday
											? "ep:text-obs-muted ep:animate-pulse"
											: "ep:text-obs-faint"
								}`}
							>
								{dot.active ? "●" : "○"}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
