import { useEffect, useState } from "preact/hooks";
import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import type { StatsTimeRange } from "@shared/types";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";

interface Metric {
	label: string;
	value: string;
}

export function TodaySection({
	statsCalculator,
	currentRange,
}: {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
}) {
	const [metrics, setMetrics] = useState<Metric[]>([]);
	const [summaryData, setSummaryData] = useState<{
		studied: number;
		dueTomorrow: number;
		dailyLoad: number;
	} | null>(null);
	const [hasError, setHasError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const summary = statsCalculator.getTodaySummary();
				const streak = statsCalculator.getStreakInfo();
				const rangeSummary =
					await statsCalculator.getRangeSummary(currentRange);

				if (cancelled) return;

				setMetrics([
					{ label: "Studied", value: summary.studied.toString() },
					{ label: "Minutes", value: summary.minutes.toString() },
					{ label: "New", value: summary.newCards.toString() },
					{ label: "Again", value: summary.again.toString() },
					{
						label: "Correct",
						value: `${Math.round(summary.correctRate * 100)}%`,
					},
					{ label: "Streak", value: `${streak.current}d` },
				]);
				setSummaryData({
					studied: summary.studied,
					dueTomorrow: rangeSummary.dueTomorrow,
					dailyLoad: rangeSummary.dailyLoad,
				});
				setHasError(false);
			} catch (err) {
				if (!cancelled) setHasError(true);
				console.error("Error refreshing today section:", err);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [statsCalculator, currentRange]);

	if (hasError) {
		return (
			<StatsCard>
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-32 ep:text-obs-error ep:text-ui-small">
					Failed to load today's statistics.
				</div>
			</StatsCard>
		);
	}

	return (
		<div class="ep:mb-5 ep:p-5 ep:rounded-lg ep:bg-obs-secondary ep:transition-all ep:duration-200">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:mb-4 ep:pb-3 ep:border-b ep:border-obs-border">
				<span class="ep:text-ui-large ep:font-semibold ep:text-obs-normal ep:tracking-tight">
					Today
				</span>
			</div>

			{/* Grid */}
			<div class="ep:grid ep:gap-3 ep:grid-cols-2 md:ep:grid-cols-3">
				{metrics.map((m) => (
					<div
						key={m.label}
						class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:p-4 ep:rounded-lg ep:bg-obs-primary ep:transition-all ep:duration-200 ep:hover:-translate-y-0.5 ep:cursor-pointer"
					>
						<span class="ep:text-3xl ep:font-semibold ep:text-obs-normal ep:mb-1 ep:font-interface">
							{m.value}
						</span>
						<span class="ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:uppercase ep:tracking-wider">
							{m.label}
						</span>
					</div>
				))}
			</div>

			{/* Summary */}
			{summaryData && (
				<div class="ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border">
					{summaryData.studied === 0 ? (
						<div class="ep:text-ui-small ep:text-obs-muted ep:italic ep:text-center">
							No cards have been studied today.
						</div>
					) : (
						<div class="ep:flex ep:flex-col ep:gap-1.5">
							<div class="ep:text-ui-small ep:text-obs-muted ep:flex ep:items-center ep:gap-2">
								<div class="ep:w-1.5 ep:h-1.5 ep:rounded-full ep:bg-obs-interactive ep:shrink-0" />
								<span>Due tomorrow: {summaryData.dueTomorrow} reviews</span>
							</div>
							<div class="ep:text-ui-small ep:text-obs-muted ep:flex ep:items-center ep:gap-2">
								<div class="ep:w-1.5 ep:h-1.5 ep:rounded-full ep:bg-obs-interactive ep:shrink-0" />
								<span>Daily load: ~{summaryData.dailyLoad} reviews/day</span>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
