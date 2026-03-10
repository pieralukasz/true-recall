import { HeatmapWidget } from "@features/study/ui/editor/widgets/analytics/HeatmapWidget";
import { useSignal } from "@preact/signals";
import type { StatsTimeRange } from "@shared/types";
import { AppNavBar } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import {
	CardMaturitySection,
	ChartCard,
	CollectionHealthBar,
	CreatedVsReviewedChart,
	DistributionSection,
	FutureDueChart,
	RangeSummary,
	RatingDistributionChart,
	RetentionChart,
	ReviewHistoryChart,
	StatsHeader,
	TodayHero,
} from "./components";
import { useStatsData } from "./hooks/use-stats-data";

export function StatsApp() {
	const plugin = usePlugin();
	const timeRange = useSignal<StatsTimeRange>("1m");
	const { data, loading } = useStatsData(timeRange);

	const distributions = useMemo(() => {
		if (!plugin.fsrsHelper) return null;
		return plugin.fsrsHelper.getDistributions();
	}, [plugin.fsrsHelper]);

	const targetRetention = Math.round(
		(plugin.settings.fsrsRequestRetention ?? 0.9) * 100,
	);

	return (
		<div class="ep:flex ep:flex-col ep:h-full">
			<AppNavBar activeItem="stats" />
			<div class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto">
				<div class="ep:p-3 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:gap-3">
					<StatsHeader timeRange={timeRange} />

					{!data && loading && (
						<div class="ep:text-xs ep:text-obs-muted ep:text-center ep:py-12">
							Loading statistics...
						</div>
					)}

					{data && (
						<>
							<TodayHero
								today={data.today}
								streak={data.streak}
								dueTomorrow={data.rangeSummary.dueTomorrow}
								dailyLoad={data.rangeSummary.dailyLoad}
								totalCards={data.totalCards}
							/>

							<ChartCard title="Activity" subtitle="Review heatmap">
								<HeatmapWidget source="months: 12" />
							</ChartCard>

							<FutureDueChart data={data.futureDue} />

							<ReviewHistoryChart data={data.reviewHistory} />

							<CardMaturitySection data={data.maturity} />

							<RetentionChart
								data={data.retention}
								targetRetention={targetRetention}
							/>

							<RatingDistributionChart data={data.ratingDistribution} />

							<CollectionHealthBar data={data.health} />

							<DistributionSection data={distributions} />

							<CreatedVsReviewedChart
								created={data.cardsCreated}
								reviewHistory={data.reviewHistory}
							/>

							<RangeSummary data={data.rangeSummary} />
						</>
					)}
				</div>
			</div>
		</div>
	);
}
