import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import {
	buildSourceUidToPresetMap,
	getSourceUidsForPreset,
} from "@features/metrics/services/stats/stats-filter.helpers";
import type { StatsFilterContext } from "@features/metrics/services/stats/stats-filter.types";
import {
	CardCountsChart,
	CollectionHealthCard,
	FutureDueChart,
	NLQueryPanel,
	NotePerformanceTable,
	RatingDistributionChart,
	RetentionChart,
	ReviewsChart,
	TimeRangeSelector,
	TodaySection,
} from "@features/metrics/ui/stats/components";
import { PresetSelector } from "@features/metrics/ui/stats/components/PresetSelector";
import { formatDateForDisplay } from "@features/metrics/ui/stats/utils/chart-helpers";
import { useSignal, useSignalEffect } from "@preact/signals";
import { cards, pluginSettings } from "@shared/services/reactive-card-store";
import type {
	CardMaturityBreakdown,
	FSRSFlashcardItem,
	StatsTimeRange,
} from "@shared/types";
import { AppNavBar } from "@shared/ui/components";
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
	const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

	const [dataKey, setDataKey] = useState(0);
	useSignalEffect(() => {
		cards.value;
		pluginSettings.value;
		setDataKey((n) => n + 1);
	});

	const presets = useMemo(
		() => plugin.presetService.getPresets(),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[plugin, dataKey],
	);

	const filterContext = useMemo((): StatsFilterContext => {
		const archivedSourceUids =
			plugin.hierarchyService.getArchivedSourceUids();

		let presetSourceUids: Set<string> | null = null;
		if (selectedPreset) {
			const allCards = plugin.flashcardManager.getAllFSRSCards();
			const uidMap = buildSourceUidToPresetMap(
				plugin.presetService,
				allCards,
			);
			presetSourceUids = getSourceUidsForPreset(selectedPreset, uidMap);
		}

		return {
			archivedSourceUids,
			presetName: selectedPreset,
			presetSourceUids,
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [plugin, selectedPreset, dataKey]);

	useEffect(() => {
		statsCalculator.setFilter(filterContext);
	}, [statsCalculator, filterContext]);

	const filterKey = `${dataKey}-${selectedPreset ?? "all"}`;

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
					<PresetSelector
						presets={presets}
						selected={selectedPreset}
						onChange={setSelectedPreset}
					/>

					<NLQueryPanel nlQueryService={plugin.nlQueryService} />

					<TodaySection
						key={`today-${filterKey}`}
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
						key={`future-${filterKey}`}
						statsCalculator={statsCalculator}
						currentRange={currentRange.value}
						onCardPreview={handleCardPreviewForDate}
					/>

					<ReviewsChart
						key={`reviews-${filterKey}`}
						statsCalculator={statsCalculator}
						currentRange={currentRange.value}
						onCardPreview={handleCardPreviewForDate}
					/>

					<RetentionChart
						key={`retention-${filterKey}`}
						statsCalculator={statsCalculator}
						currentRange={currentRange.value}
					/>

					<RatingDistributionChart
						key={`rating-dist-${filterKey}`}
						statsCalculator={statsCalculator}
						currentRange={currentRange.value}
					/>

					<CollectionHealthCard
						key={`health-${filterKey}`}
						statsCalculator={statsCalculator}
					/>

					<CardCountsChart
						key={`counts-${filterKey}`}
						statsCalculator={statsCalculator}
						onCategoryClick={handleCardPreviewForCategory}
					/>

					<NotePerformanceTable
						key={`note-perf-${filterKey}`}
						statsCalculator={statsCalculator}
					/>
				</div>
			</div>
		</div>
	);
}
