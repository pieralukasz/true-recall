import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import {
	dataVersion,
	settingsVersion,
	syncVersion,
	useSignalVersion,
} from "@shared/services/signals";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { DashboardHeader } from "./components/DashboardHeader";
import { NoteList } from "./components/NoteList";
import { RecentlyStudiedSection } from "./components/RecentlyStudiedSection";
import { SessionActions } from "./components/SessionActions";
import { StudyProgress } from "./components/StudyProgress";
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
		<div class="ep:p-4 ep:mx-auto ep:max-w-2xl ep:flex ep:flex-col ep:gap-5">
			<DashboardHeader
				totalDue={data.totalDue}
				totalNew={data.totalNew}
				noteCount={data.noteCount}
				estimatedMinutes={data.estimatedTotalMinutes}
				streak={data.streak}
			/>

			<StudyProgress progress={data.todayProgress} />

			<SessionActions
				totalDue={data.totalDue}
				totalOverdue={data.totalOverdue}
				estimatedMinutes={data.estimatedTotalMinutes}
			/>

			<NoteList notes={data.notes} />

			<RecentlyStudiedSection notes={data.notes} />
		</div>
	);
}
