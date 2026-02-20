import { useEffect, useMemo, useState } from "preact/hooks";
import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import type { FSRSFlashcardItem } from "@shared/types";
import { getHeatmapLevelClasses } from "@features/metrics/ui/stats/utils/chart-helpers";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";

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

	return (
		<StatsCard title="Activity calendar">
			{/* Year header */}
			<div class="ep:text-center ep:text-ui-small ep:font-semibold ep:mb-3 ep:text-obs-normal">
				{today.getFullYear()}
			</div>

			{/* Calendar grid */}
			<div class="ep:flex ep:gap-0.5 ep:flex-nowrap ep:overflow-x-auto ep:pb-2 true-recall-scrollbar-thin">
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
