import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { CalendarHeatmap } from "@features/metrics/ui/stats/components";
import { formatDateForDisplay } from "@features/metrics/ui/stats/utils/chart-helpers";
import { effect } from "@preact/signals-core";
import {
	dataVersion,
	settingsVersion,
	syncVersion,
	track,
} from "@shared/services/signals";
import type { FSRSFlashcardItem } from "@shared/types";
import { CardPreviewModal } from "@shared/ui/modals";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
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

	const data = useMemo((): AggregatedData => {
		void refreshTick;

		const allCards = plugin.flashcardManager.getAllFSRSCards();
		const now = new Date();
		const streakInfo = statsCalculator.getStreakInfo();

		let due = 0;
		let newCount = 0;
		let learning = 0;

		const noteMap = new Map<
			string,
			NoteAggregation
		>();

		for (const card of allCards) {
			const fsrs = card.fsrs;
			if (
				fsrs.suspended ||
				(fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
			)
				continue;

			// Global counts
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

			// Per-note aggregation
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
			stats: {
				due,
				newCount,
				learning,
				streak: streakInfo.current,
			},
			notes: Array.from(noteMap.values()),
			totalDue: due + learning,
		};
	}, [plugin, statsCalculator, refreshTick]);

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

	return (
		<div class="ep:p-4 ep:max-w-[700px] ep:mx-auto">
			<DashboardStatCards stats={data.stats} />
			<StudyNowButton dueCount={data.totalDue} />
			<CalendarHeatmap
				statsCalculator={statsCalculator}
				onCardPreview={handleCardPreviewForDate}
			/>
			<div class="ep:mt-4">
				<DueProjectsSection notes={data.notes} />
				<RecentlyStudiedSection notes={data.notes} />
			</div>
		</div>
	);
}
