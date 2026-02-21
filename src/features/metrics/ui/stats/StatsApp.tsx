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
import { useSignal } from "@preact/signals";
import { effect } from "@preact/signals-core";
import {
	dataVersion,
	settingsVersion,
	syncVersion,
	track,
} from "@shared/services/signals";
import type {
	CardMaturityBreakdown,
	FSRSFlashcardItem,
	StatsTimeRange,
} from "@shared/types";
import { CardPreviewModal } from "@shared/ui/modals";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

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

	// Refresh tick: bumped by signals, forces re-render of children
	const [refreshTick, setRefreshTick] = useState(0);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		const disposer = effect(() => {
			track(dataVersion, settingsVersion, syncVersion);
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				setRefreshTick((t) => t + 1);
				timer = null;
			}, 500);
		});
		return () => {
			disposer();
			if (timer) clearTimeout(timer);
		};
	}, []);

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

	// The refreshTick is used as a key suffix to force remounting of data-fetching components
	// when signals fire, replicating the old imperative refresh() behavior.
	const dataKey = refreshTick;

	return (
		<div class="ep:p-2 ep:max-w-[900px] ep:mx-auto">
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
	);
}
