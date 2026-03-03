import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import {
	CalendarHeatmap,
	CardCountsChart,
	CollectionHealthCard,
	CreationSourceChart,
	FutureDueChart,
	NLQueryPanel,
	NotePerformanceTable,
	RatingDistributionChart,
	RetentionChart,
	ReviewsChart,
	TimeRangeSelector,
	TodaySection,
} from "@features/metrics/ui/stats/components";
import { formatDateForDisplay } from "@features/metrics/ui/stats/utils/chart-helpers";
import { useComputed, useSignal } from "@preact/signals";
import { cards } from "@shared/services/reactive-card-store";
import { settingsVersion } from "@shared/services/signals";
import type {
	CardMaturityBreakdown,
	FSRSFlashcardItem,
	StatsTimeRange,
} from "@shared/types";
import { AppNavBar } from "@shared/ui/components";
import { CardPreviewModal } from "@shared/ui/modals";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useMemo, useRef } from "preact/hooks";

export function StatsApp() {
	const plugin = usePlugin();

	const statsCalculator = useMemo(() => {
		const calc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);
		calc.setSqliteStore(plugin.cardStore);
		return calc;
	}, [plugin]);

	const currentRange = useSignal<StatsTimeRange>("1m");

	const keyCounter = useRef(0);
	const dataKey = useComputed(() => {
		cards.value;
		settingsVersion.value;
		return ++keyCounter.current;
	}).value;

	const handleCardPreviewForDate = useCallback(
		(date: string, cards: FSRSFlashcardItem[]) => {
			new CardPreviewModal(plugin.app, {
				title: `Cards reviewed: ${formatDateForDisplay(date)}`,
				cards,
				flashcardManager: plugin.flashcardManager,
			}).open();
		},
		[plugin],
	);

	const handleCardPreviewForCategory = useCallback(
		(
			category: keyof CardMaturityBreakdown,
			label: string,
			cards: FSRSFlashcardItem[],
		) => {
			new CardPreviewModal(plugin.app, {
				title: `${label} cards (${cards.length})`,
				cards,
				flashcardManager: plugin.flashcardManager,
				category,
			}).open();
		},
		[plugin],
	);

	return (
		<div class="ep:flex ep:flex-col ep:h-full">
			<AppNavBar activeItem="stats" />
			<div class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto">
				<div class="ep:p-3 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:gap-3">
					<NLQueryPanel nlQueryService={plugin.nlQueryService} />

					<TodaySection
						key={`today-${dataKey}`}
						statsCalculator={statsCalculator}
						currentRange={currentRange.value}
					/>

					<TimeRangeSelector
						currentRange={currentRange.value}
						onRangeChange={(range) => {
							currentRange.value = range;
						}}
					/>

					<FutureDueChart
						key={`future-${dataKey}`}
						statsCalculator={statsCalculator}
						currentRange={currentRange.value}
						onCardPreview={handleCardPreviewForDate}
					/>

					<ReviewsChart
						key={`reviews-${dataKey}`}
						statsCalculator={statsCalculator}
						currentRange={currentRange.value}
						onCardPreview={handleCardPreviewForDate}
					/>

					<RetentionChart
						key={`retention-${dataKey}`}
						statsCalculator={statsCalculator}
						currentRange={currentRange.value}
					/>

					<RatingDistributionChart
						key={`rating-dist-${dataKey}`}
						statsCalculator={statsCalculator}
						currentRange={currentRange.value}
					/>

					<CollectionHealthCard
						key={`health-${dataKey}`}
						statsCalculator={statsCalculator}
					/>

					<CardCountsChart
						key={`counts-${dataKey}`}
						statsCalculator={statsCalculator}
						onCategoryClick={handleCardPreviewForCategory}
					/>

					<NotePerformanceTable
						key={`note-perf-${dataKey}`}
						statsCalculator={statsCalculator}
					/>

					<CreationSourceChart
						key={`creation-source-${dataKey}`}
						statsCalculator={statsCalculator}
					/>

					<CalendarHeatmap
						key={`heatmap-${dataKey}`}
						statsCalculator={statsCalculator}
						onCardPreview={handleCardPreviewForDate}
					/>
				</div>
			</div>
		</div>
	);
}
