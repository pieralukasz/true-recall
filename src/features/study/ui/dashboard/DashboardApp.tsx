import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import {
	dataVersion,
	settingsVersion,
	syncVersion,
	useSignalVersion,
} from "@shared/services/signals";
import { SearchInput } from "@shared/ui/components/SearchInput";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { DashboardTabs } from "./components/DashboardTabs";
import { HeroCard } from "./components/HeroCard";
import { NoteList } from "./components/NoteList";
import { ProjectsTab } from "./components/ProjectsTab";
import { RecentlyStudiedBar } from "./components/RecentlyStudiedBar";
import { HeatmapWidget } from "../editor/widgets/HeatmapWidget";
import { aggregateDashboardData } from "./helpers/note-aggregation";
import { aggregateProjectData } from "./helpers/project-aggregation";
import type { DashboardAggregation, DashboardTab } from "./types";

export function DashboardApp() {
	const plugin = usePlugin();
	const activeTab = useSignal<DashboardTab>("projects");
	const searchQuery = useSignal("");

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

	const projectData = useMemo(() => {
		return aggregateProjectData({
			notes: data.notes,
			plugin: {
				projectLinkService: plugin.projectLinkService,
				cardStore: plugin.cardStore,
				fsrsService: plugin.fsrsService,
			},
		});
	}, [plugin, data.notes]);

	const enrichedNotes = useMemo(() => {
		return data.notes.map((note) => ({
			...note,
			projects: projectData.noteProjectMap.get(note.name) ?? [],
		}));
	}, [data.notes, projectData.noteProjectMap]);

	const allProjectNames = useMemo(() => {
		const names = new Set<string>();
		for (const projects of projectData.noteProjectMap.values()) {
			for (const p of projects) names.add(p);
		}
		return Array.from(names).sort();
	}, [projectData.noteProjectMap]);

	const handleNavigateToNote = (noteName: string) => {
		void plugin.app.workspace.openLinkText(noteName, "");
	};

	const handleStudyNote = (noteName: string) => {
		void plugin.openReviewViewWithFilters({
			sourceNoteFilter: noteName,
			ignoreDailyLimits: true,
		});
	};

	const handleCustomStudyNote = (noteName: string) => {
		void plugin.openCustomStudyModal({
			sourceNoteFilters: [noteName],
			scopeLabel: noteName,
		});
	};

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

			{/* Recently studied bar */}
			{projectData.recentlyStudied.length > 0 && (
				<div class="ep:shrink-0 ep:mb-3">
					<RecentlyStudiedBar notes={projectData.recentlyStudied} />
				</div>
			)}

			{/* Search input — shared across all tabs */}
			<div class="ep:shrink-0 ep:mb-3">
				<SearchInput
					value={searchQuery.value}
					placeholder="Search notes or projects..."
					onChange={(q) => {
						searchQuery.value = q;
					}}
				/>
			</div>

			{/* Tab bar */}
			<div class="ep:shrink-0 ep:mb-3">
				<DashboardTabs
					activeTab={activeTab.value}
					onTabChange={(tab) => {
						activeTab.value = tab;
						searchQuery.value = "";
					}}
					projectCount={projectData.projects.length}
					notesCount={enrichedNotes.length}
				/>
			</div>

			{/* Tab content */}
			<div class="ep:flex-1 ep:min-h-0 ep:flex ep:flex-col">
				{activeTab.value === "projects" && (
					<ProjectsTab
						projects={projectData.projects}
						searchQuery={searchQuery.value}
						onNavigateToNote={handleNavigateToNote}
						onStudyNote={handleStudyNote}
						onCustomStudyNote={handleCustomStudyNote}
					/>
				)}

				{activeTab.value === "notes" && (
					<NoteList
						notes={enrichedNotes}
						searchQuery={searchQuery.value}
						allProjectNames={allProjectNames}
					/>
				)}
			</div>

			{/* Activity heatmap */}
			<div class="ep:shrink-0 ep:mt-4">
				<HeatmapWidget source="months: 0" />
			</div>
		</div>
	);
}
