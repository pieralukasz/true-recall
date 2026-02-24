import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import {
	dataVersion,
	settingsVersion,
	syncVersion,
	useSignalVersion,
} from "@shared/services/signals";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import {
	DashboardStatCards,
	type DashboardStats,
} from "./components/DashboardStatCards";
import { DueProjectsSection } from "./components/DueProjectsSection";
import { RecentlyStudiedSection } from "./components/RecentlyStudiedSection";
import { StudyNowButton } from "./components/StudyNowButton";

export interface NoteAggregation {
	name: string;
	path: string | null;
	due: number;
	newCount: number;
	learning: number;
	total: number;
	lastReview: string | null;
}

interface AggregatedData {
	stats: DashboardStats;
	notes: NoteAggregation[];
	totalDue: number;
}

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

	const refreshTick = useSignalVersion(dataVersion, settingsVersion, syncVersion);

	const data = useMemo((): AggregatedData => {
		const allCards = plugin.flashcardManager.getAllFSRSCards();
		const now = new Date();
		const streakInfo = statsCalculator.getStreakInfo();

		let due = 0;
		let newCount = 0;
		let learning = 0;

		const noteMap = new Map<string, NoteAggregation>();

		for (const card of allCards) {
			const fsrs = card.fsrs;
			if (
				fsrs.suspended ||
				(fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
			)
				continue;

			switch (fsrs.state) {
				case 0:
					newCount++;
					break;
				case 1:
				case 3:
					learning++;
					break;
				case 2:
					if (new Date(fsrs.due) <= now) due++;
					break;
			}

			const noteName = card.sourceNoteName;
			if (!noteName) continue;

			let entry = noteMap.get(noteName);
			if (!entry) {
				entry = {
					name: noteName,
					path: fsrs.sourceNotePath ?? null,
					due: 0,
					newCount: 0,
					learning: 0,
					total: 0,
					lastReview: null,
				};
				noteMap.set(noteName, entry);
			}
			entry.total++;

			switch (fsrs.state) {
				case 0:
					entry.newCount++;
					break;
				case 1:
				case 3:
					entry.learning++;
					break;
				case 2:
					if (new Date(fsrs.due) <= now) entry.due++;
					break;
			}

			if (
				fsrs.lastReview &&
				(!entry.lastReview || fsrs.lastReview > entry.lastReview)
			) {
				entry.lastReview = fsrs.lastReview;
			}
		}

		return {
			stats: { due, newCount, learning, streak: streakInfo.current },
			notes: Array.from(noteMap.values()),
			totalDue: due + learning,
		};
	}, [plugin, statsCalculator, refreshTick]);

	return (
		<div class="ep:p-4 ep:mx-auto">
			{/* Top row: stat cards + study button */}
			<div class="ep:flex ep:items-start ep:gap-4 ep:mb-6">
				<DashboardStatCards stats={data.stats} />
				<StudyNowButton dueCount={data.totalDue} />
			</div>

			{/* 2-column grid: Due Now | Recently Studied */}
			<div class="ep:grid ep:grid-cols-2 ep:gap-4">
				<DueProjectsSection notes={data.notes} />
				<RecentlyStudiedSection notes={data.notes} />
			</div>
		</div>
	);
}
