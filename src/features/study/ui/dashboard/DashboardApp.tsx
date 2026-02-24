import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import {
	dataVersion,
	settingsVersion,
	syncVersion,
	useSignalVersion,
} from "@shared/services/signals";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { HeroCard } from "./components/HeroCard";
import { NoteList } from "./components/NoteList";
import { Sidebar } from "./components/Sidebar";
import { aggregateDashboardData } from "./helpers/note-aggregation";
import type { DashboardAggregation } from "./types";

export function DashboardApp() {
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

	const refreshTick = useSignalVersion(
		dataVersion,
		settingsVersion,
		syncVersion,
	);

	const data = useMemo((): DashboardAggregation => {
		const allCards = plugin.flashcardManager.getAllFSRSCards();
		const streakInfo = statsCalculator.getStreakInfo();
		const todaySummary = statsCalculator.getTodaySummary();

		return aggregateDashboardData({
			allCards,
			streakCurrent: streakInfo.current,
			todaySummary,
			newCardsCap: plugin.settings.newCardsPerDay,
			reviewsCap: plugin.settings.reviewsPerDay,
		});
	}, [plugin, statsCalculator, refreshTick]);

	return (
		<div class="ep-dashboard-container ep:p-4 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:h-full">
			<div class="ep:shrink-0 ep:mb-5">
				<HeroCard
					totalDue={data.totalDue}
					totalNew={data.totalNew}
					totalOverdue={data.totalOverdue}
					noteCount={data.noteCount}
					estimatedMinutes={data.estimatedTotalMinutes}
					streak={data.streak}
					progress={data.todayProgress}
				/>
			</div>

			<div class="ep:flex-1 ep:min-h-0 ep:grid ep:grid-cols-1 ep:gap-5 ep-dashboard-two-col">
				<div class="ep:min-h-0 ep:overflow-hidden ep:h-full ep:flex ep:flex-col ep:order-2 ep-dashboard-notes">
					<NoteList notes={data.notes} />
				</div>
				<div class="ep:order-1 ep:overflow-y-auto ep-dashboard-sidebar">
					<Sidebar notes={data.notes} />
				</div>
			</div>
		</div>
	);
}
