import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { dataVersion, useSignalVersion } from "@shared/services/signals";
import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
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
	const ver = useSignalVersion(dataVersion);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useMemo((): StreakData | null => {
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
	}, [plugin, ver]);

	if (!data) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	const showLongest = configValue(config, "showLongest", true);
	const showWeekDots = configValue(config, "showWeekDots", true);
	const showTodayRate = configValue(config, "showTodayRate", true);

	const handleReviewClick = () => {
		plugin.openCustomStudyModal().catch(() => {});
	};

	const handleStreakClick = () => {
		plugin.openStatsView().catch(() => {});
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			{/* Top row: streak + today + action */}
			<div class="ep:flex ep:items-center ep:gap-3 ep:flex-wrap ep:text-xs">
				<Clickable
					class="ep:font-semibold hover:ep:underline"
					onClick={handleStreakClick}
					title="Open statistics"
				>
					{data.current}d streak
				</Clickable>

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
