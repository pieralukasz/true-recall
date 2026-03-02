import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import {
	dataVersion,
	metadataVersion,
	settingsVersion,
	syncVersion,
	useSignalVersion,
} from "@shared/services/signals";
import { SearchCombobox } from "@shared/ui/components/SearchCombobox";
import type { SearchSuggestion, SuggestionProvider } from "@shared/ui/helpers/search-suggestions.types";
import { PresetOptionsModal } from "@shared/ui/modals/PresetOptionsModal";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { AppNavBar } from "@shared/ui/components";
import { StreakWidget } from "../editor/widgets/analytics/StreakWidget";
import { DashboardTabs } from "./components/DashboardTabs";
import { NoteList } from "./components/NoteList";
import { ProjectsTab } from "./components/ProjectsTab";
import { RecentlyStudiedBar } from "./components/RecentlyStudiedBar";
import { HeatmapWidget } from "../editor/widgets/analytics/HeatmapWidget";
import { aggregateDashboardData } from "./helpers/note-aggregation";
import { useInitialMount } from "./helpers/use-initial-mount";
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
	}, [plugin, data.notes, refreshTick]);

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

	const getDashboardSuggestions: SuggestionProvider = useMemo(() => {
		const noteNames = enrichedNotes.map((n) => n.name);
		return (inputValue: string): SearchSuggestion[] => {
			const q = inputValue.toLowerCase().trim();
			if (!q) return [];
			const results: SearchSuggestion[] = [];
			for (const name of noteNames) {
				if (name.toLowerCase().includes(q)) {
					results.push({
						id: `note-${name}`,
						label: name,
						insertText: name,
						category: "note",
						description: "Note",
					});
				}
				if (results.length >= 8) break;
			}
			for (const p of allProjectNames) {
				if (p.toLowerCase().includes(q)) {
					results.push({
						id: `project-${p}`,
						label: p,
						insertText: p,
						category: "project",
						description: "Project",
					});
				}
				if (results.length >= 12) break;
			}
			return results;
		};
	}, [enrichedNotes, allProjectNames]);

	const handleStudyNote = (noteName: string, projectPath?: string) => {
		void plugin.openReviewViewWithFilters({
			sourceNoteFilter: noteName,
			projectPath,
			ignoreDailyLimits: true,
		});
	};

	const handlePresetClick = useCallback(
		(path: string | null) => {
			if (!path) return;
			const chain = plugin.presetService.resolvePresetChain(path);
			const presetId = chain.effective.preset.id;
			const name = path.split("/").pop()?.replace(/\.md$/, "");
			new PresetOptionsModal(plugin.app, plugin, {
				initialPresetId: presetId,
				contextPath: path,
				contextName: name,
			}).open();
		},
		[plugin],
	);

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

	const initialMount = useInitialMount();
	let si = 0;
	const sectionProps = () =>
		initialMount.current
			? ({
					class: "ep-section-enter",
					style: { "--section-index": si++ },
				} as Record<string, unknown>)
			: {};

	return (
		<div class="ep-dashboard-container ep:flex ep:flex-col ep:h-full">
			<AppNavBar activeItem="dashboard" />
			<div
				ref={scrollContainerRef}
				class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto"
				onScroll={onScroll}
			>
				<div class="ep:p-3 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:gap-3 ep:min-h-full">
					<div {...sectionProps()}>
						<StreakWidget source="" />
					</div>

					{projectData.recentlyStudied.length > 0 && (
						<div {...sectionProps()}>
							<RecentlyStudiedBar
								notes={projectData.recentlyStudied}
							/>
						</div>
					)}

					<div {...sectionProps()}>
						<SearchCombobox
							value={searchQuery.value}
							placeholder="Search notes or projects..."
							onChange={(q) => {
								searchQuery.value = q;
							}}
							getSuggestions={getDashboardSuggestions}
						/>
					</div>

					<div {...sectionProps()}>
						<DashboardTabs
							activeTab={activeTab.value}
							onTabChange={handleTabChange}
							projectCount={projectData.projects.length}
							notesCount={enrichedNotes.length}
						/>
					</div>

					<div class="ep:flex ep:flex-col ep:flex-1">
						<div
							class={`ep:flex-1${initialMount.current ? " ep-section-enter" : ""}`}
							style={
								initialMount.current
									? { "--section-index": si++ }
									: undefined
							}
						>
							{activeTab.value === "projects" && (
								<ProjectsTab
									projects={projectData.projects}
									searchQuery={searchQuery.value}
									scrollContainerRef={scrollContainerRef}
									scrollTop={scrollTop}
									onStudyNote={handleStudyNote}
									onPresetClick={handlePresetClick}
								/>
							)}

							{activeTab.value === "notes" && (
								<NoteList
									notes={enrichedNotes}
									searchQuery={searchQuery.value}
									allProjectNames={allProjectNames}
									scrollContainerRef={scrollContainerRef}
									scrollTop={scrollTop}
									onPresetClick={handlePresetClick}
								/>
							)}
						</div>

						<div
							class={`ep:mt-3${initialMount.current ? " ep-section-enter" : ""}`}
							style={
								initialMount.current
									? { "--section-index": si++ }
									: undefined
							}
						>
							<HeatmapWidget source="months: 0" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
