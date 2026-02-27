import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import {
	dataVersion,
	metadataVersion,
	settingsVersion,
	syncVersion,
	useSignalVersion,
} from "@shared/services/signals";
import { SearchInput } from "@shared/ui/components/SearchInput";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { StreakWidget } from "../editor/widgets/analytics/StreakWidget";
import { DashboardNavBar } from "./components/DashboardNavBar";
import { DashboardTabs } from "./components/DashboardTabs";
import { NoteList } from "./components/NoteList";
import { ProjectsTab } from "./components/ProjectsTab";
import { RecentlyStudiedBar } from "./components/RecentlyStudiedBar";
import { HeatmapWidget } from "../editor/widgets/analytics/HeatmapWidget";
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
		metadataVersion,
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
				frontmatterIndex: plugin.frontmatterIndex,
			},
		});
	}, [plugin, data.notes]);

	const enrichedNotes = useMemo(() => {
		return data.notes.map((note) => {
			const projects = projectData.noteProjectMap.get(note.name) ?? [];
			let presetName: string | undefined;
			if (note.path) {
				const vals = plugin.frontmatterIndex.getValues(
					"fsrs_preset",
					note.path,
				);
				if (vals.length > 0 && vals[0]) presetName = vals[0];
			}
			return { ...note, projects, presetName };
		});
	}, [data.notes, projectData.noteProjectMap, plugin]);

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

	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const scrollTop = useSignal(0);

	const onScroll = useCallback((e: Event) => {
		scrollTop.value = (e.currentTarget as HTMLDivElement).scrollTop;
	}, []);

	const handleTabChange = (tab: DashboardTab) => {
		activeTab.value = tab;
		searchQuery.value = "";
		scrollTop.value = 0;
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop = 0;
		}
	};

	return (
		<div class="ep-dashboard-container ep:flex ep:flex-col ep:h-full">
			<DashboardNavBar />
			<div
				ref={scrollContainerRef}
				class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto"
				onScroll={onScroll}
			>
				<div class="ep:p-3 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:gap-3 ep:min-h-full">
					<StreakWidget source="" />

					{projectData.recentlyStudied.length > 0 && (
						<RecentlyStudiedBar
							notes={projectData.recentlyStudied}
						/>
					)}

					<SearchInput
						value={searchQuery.value}
						placeholder="Search notes or projects..."
						onChange={(q) => {
							searchQuery.value = q;
						}}
					/>

					<DashboardTabs
						activeTab={activeTab.value}
						onTabChange={handleTabChange}
						projectCount={projectData.projects.length}
						notesCount={enrichedNotes.length}
					/>

					<div class="ep:flex ep:flex-col ep:flex-1">
						<div class="ep:flex-1">
							{activeTab.value === "projects" && (
								<ProjectsTab
									projects={projectData.projects}
									searchQuery={searchQuery.value}
									scrollContainerRef={scrollContainerRef}
									scrollTop={scrollTop}
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
									scrollContainerRef={scrollContainerRef}
									scrollTop={scrollTop}
								/>
							)}
						</div>

						<div class="ep:mt-3">
							<HeatmapWidget source="months: 0" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
