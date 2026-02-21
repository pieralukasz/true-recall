import type { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";
import { getHeatmapLevelClasses } from "@features/metrics/ui/stats/utils/chart-helpers";
import type { FSRSFlashcardItem } from "@shared/types";
import { useEffect, useMemo, useState } from "preact/hooks";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function CalendarHeatmap({
	statsCalculator,
	onCardPreview,
}: {
	statsCalculator: StatsCalculatorService;
	onCardPreview: (date: string, cards: FSRSFlashcardItem[]) => void;
}) {
	const [allStats, setAllStats] = useState<
		Record<string, { reviewsCompleted: number }>
	>({});

	useEffect(() => {
		try {
			const stats = statsCalculator.getAllDailyStats();
			setAllStats(stats);
		} catch (err) {
			console.error("Error refreshing calendar heatmap:", err);
			setAllStats({});
		}
	}, [statsCalculator]);

	const today = useMemo(() => new Date(), []);
	const startDate = useMemo(() => {
		const d = new Date(today);
		d.setDate(d.getDate() - 364);
		d.setDate(d.getDate() - d.getDay());
		return d;
	}, [today]);

	const weeks = useMemo(() => {
		const result: Array<
			Array<{
				dateKey: string;
				count: number;
				isFuture: boolean;
			}>
		> = [];
		for (let week = 0; week < 53; week++) {
			const days: (typeof result)[0] = [];
			for (let day = 0; day < 7; day++) {
				const cellDate = new Date(startDate);
				cellDate.setDate(cellDate.getDate() + week * 7 + day);
				const dateKey = cellDate.toISOString().split("T")[0] ?? "";
				const stats = allStats[dateKey];
				days.push({
					dateKey,
					count: stats?.reviewsCompleted ?? 0,
					isFuture: cellDate > today,
				});
			}
			result.push(days);
		}
		return result;
	}, [allStats, startDate, today]);

	// Compute month label for each week column:
	// show month name when the first day of a new month falls in that week
	const monthLabels = useMemo(() => {
		return weeks.map((week, wi) => {
			const firstCell = week[0];
			if (!firstCell) return null;
			const d = new Date(firstCell.dateKey);
			// Show month label on the week that contains the 1st day of the month
			// (or on week 0 to always show a start label)
			const dayOfMonth = d.getDate();
			if (dayOfMonth <= 7 || wi === 0) {
				return MONTHS[d.getMonth()] ?? null;
			}
			return null;
		});
	}, [weeks]);

	return (
		<StatsCard title="Activity calendar">
			<div class="ep:flex ep:gap-0.5">
				{/* Day-of-week labels */}
				<div class="ep:flex ep:flex-col ep:gap-0.5 ep:mr-1 ep:pt-5">
					{DAY_LABELS.map((label, i) => (
						<div
							key={i}
							class="ep:h-3 ep:w-6 ep:text-[9px] ep:leading-3 ep:text-obs-faint ep:text-right ep:select-none"
						>
							{label}
						</div>
					))}
				</div>

				{/* Calendar grid with month labels */}
				<div class="ep:flex-1 ep:overflow-x-auto ep:pb-2 true-recall-scrollbar-thin">
					{/* Month labels row */}
					<div class="ep:flex ep:gap-0.5 ep:mb-1 ep:h-4">
						{weeks.map((_, wi) => (
							<div
								key={wi}
								class="ep:w-3 ep:shrink-0 ep:text-[9px] ep:leading-4 ep:text-obs-faint ep:select-none ep:overflow-visible ep:whitespace-nowrap"
							>
								{monthLabels[wi] ?? ""}
							</div>
						))}
					</div>

					{/* Week columns */}
					<div class="ep:flex ep:gap-0.5 ep:flex-nowrap">
						{weeks.map((week, wi) => (
							<div key={wi} class="ep:flex ep:flex-col ep:gap-0.5">
								{week.map((cell) => (
									<button
										type="button"
										key={cell.dateKey}
										class={[
											"ep:w-3 ep:h-3 ep:rounded-sm ep:cursor-pointer ep:transition-all ep:duration-200 ep:hover:scale-110 ep:hover:opacity-80 ep:border-none ep:p-0",
											getHeatmapLevelClasses(cell.count),
											cell.isFuture ? "ep:opacity-30" : "",
										].join(" ")}
										title={`${cell.dateKey}: ${cell.count} reviews`}
										aria-label={`${cell.dateKey}: ${cell.count} reviews`}
										onClick={() => {
											if (cell.count > 0) {
												const cards = statsCalculator.getCardsDueOnDate(
													cell.dateKey,
												);
												onCardPreview(cell.dateKey, cards);
											}
										}}
									/>
								))}
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Legend */}
			<div class="ep:flex ep:items-center ep:justify-end ep:gap-1 ep:mt-3 ep:text-ui-smaller ep:text-obs-muted">
				<span>Less</span>
				{[0, 1, 10, 25, 50].map((count) => (
					<div
						key={count}
						class={[
							"ep:w-3 ep:h-3 ep:rounded-sm ep:cursor-default",
							getHeatmapLevelClasses(count),
						].join(" ")}
					/>
				))}
				<span>More</span>
			</div>
		</StatsCard>
	);
}
