import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { computeActionableSessionSnapshot } from "@features/study/services/actionable-session-snapshot.service";
import { filterActiveCards } from "@features/study/ui/review/helpers/session-helpers";
import {
	allCardsArray,
	archivedSourceUids as archivedSourceUidsSignal,
	pluginSettings,
} from "@shared/services/reactive-card-store";
import { SearchCombobox } from "@shared/ui/components/SearchCombobox";
import type { SearchSuggestion, SuggestionProvider } from "@shared/ui/helpers/search-suggestions.types";
import { PresetOptionsModal } from "@shared/ui/modals/PresetOptionsModal";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useMemo, useRef } from "preact/hooks";
import { useComputed, useSignal } from "@preact/signals";
import { AppNavBar } from "@shared/ui/components";
import { TodayActionBar } from "./components/TodayActionBar";
import { DashboardTabs } from "./components/DashboardTabs";
import { NoteList } from "./components/NoteList";
import { ProjectsTab } from "./components/ProjectsTab";
import { RecentlyStudiedBar } from "./components/RecentlyStudiedBar";
import { HeatmapWidget } from "../editor/widgets/analytics/HeatmapWidget";
import { BottomActionBar } from "./components/BottomActionBar";
import { aggregateDashboardData } from "./helpers/note-aggregation";
import { computePriority } from "./helpers/note-priority";
import { estimateStudyMinutes } from "./helpers/time-estimate";
import { useDragAutoScroll } from "./helpers/use-drag-auto-scroll";
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

	const showArchived = useSignal(false);

	const data = useComputed((): DashboardAggregation => {
		const allCards = allCardsArray.value;
		pluginSettings.value;
		const archived = archivedSourceUidsSignal.value;
		const streakInfo = statsCalculator.getStreakInfo();
		const todaySummary = statsCalculator.getTodaySummary();
		const snapshotDeps = {
			allCards,
			archivedSourceUids: archived,
			settings: plugin.settings,
			sessionPersistence: plugin.sessionPersistence,
			presetService: plugin.presetService,
			metadataCache: plugin.app.metadataCache,
			hierarchyService: plugin.hierarchyService,
			fsrsService: plugin.fsrsService,
		};
		const activeCards = filterActiveCards(allCards, {
			archivedSourceUids: new Set(archived),
		});
		const snapshotCache = new Map<string, ReturnType<typeof computeActionableSessionSnapshot>>();

		const raw = aggregateDashboardData({
			allCards,
			streakCurrent: streakInfo.current,
			todaySummary,
			newCardsCap: plugin.settings.newCardsPerDay,
			reviewsCap: plugin.settings.reviewsPerDay,
			archivedSourceUids: showArchived.value ? undefined : archived,
		});

		const globalSnapshot = computeActionableSessionSnapshot(
			snapshotDeps,
			{},
			{ cache: snapshotCache, activeCards },
		);

		const actionableNotes = raw.notes.map((note) => {
			const noteSnapshot = computeActionableSessionSnapshot(
				snapshotDeps,
				{ sourceNoteFilter: note.name },
				{ cache: snapshotCache, activeCards },
			);
			const due = noteSnapshot.counts.due;
			const newCount = noteSnapshot.counts.new;
			const learning = noteSnapshot.counts.learning;
			return {
				...note,
				due,
				newCount,
				learning,
				estimatedMinutes: estimateStudyMinutes(due, newCount, learning),
				priority: computePriority({
					...note,
					due,
					newCount,
					learning,
				}),
			};
		});

		return {
			...raw,
			notes: actionableNotes,
			totalDue: globalSnapshot.counts.due,
			totalNew: globalSnapshot.counts.new,
			totalLearning: globalSnapshot.counts.learning,
			estimatedTotalMinutes: estimateStudyMinutes(
				globalSnapshot.counts.due,
				globalSnapshot.counts.new,
				globalSnapshot.counts.learning,
			),
		};
	}).value;

	const visibleNotes = useMemo(() => {
		if (showArchived.value) return data.notes;

		return data.notes.filter((note) => {
			if (!note.path) return true;
			if (plugin.hierarchyService.isNoteArchived(note.path)) return false;

			// Hide notes that live under archived projects, including nested parents.
			const stack = [...plugin.hierarchyService.getParentsForNote(note.path)];
			const visited = new Set<string>();

			while (stack.length > 0) {
				const parentPath = stack.pop();
				if (!parentPath || visited.has(parentPath)) continue;
				visited.add(parentPath);

				if (plugin.hierarchyService.isProjectArchived(parentPath)) {
					return false;
				}

				const grandParents = plugin.hierarchyService.getParentsForNote(parentPath);
				for (const gp of grandParents) stack.push(gp);
			}

			return true;
		});
	}, [data.notes, plugin, showArchived.value]);

	const projectData = useMemo(() => {
		const allCards = allCardsArray.value;
		const archived = archivedSourceUidsSignal.value;
		const activeCards = filterActiveCards(allCards, {
			archivedSourceUids: new Set(archived),
		});
		return aggregateProjectData({
			notes: visibleNotes,
			showArchived: showArchived.value,
			plugin: {
				hierarchyService: plugin.hierarchyService,
				cardStore: plugin.cardStore,
				fsrsService: plugin.fsrsService,
				presetService: plugin.presetService,
				sessionPersistence: plugin.sessionPersistence,
				settings: plugin.settings,
				allCards,
				archivedSourceUids: archived,
				activeCards,
				metadataCache: plugin.app.metadataCache,
			},
		});
	}, [plugin, visibleNotes, showArchived.value]);

	const enrichedNotes = useMemo(() => {
		return visibleNotes.map((note) => {
			const projects = projectData.noteProjectMap.get(note.name) ?? [];

			const preset = note.path
				? plugin.presetService.resolvePresetChain(note.path).effective.preset
				: null;

			const archived =
				showArchived.value && note.path
					? plugin.hierarchyService.isNoteArchived(note.path)
					: undefined;

			return {
				...note,
				projects,
				presetName: preset?.name,
				...(archived ? { archived } : {}),
			};
		});
	}, [visibleNotes, projectData.noteProjectMap, plugin, showArchived.value]);

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
	useDragAutoScroll(scrollContainerRef);

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
						<TodayActionBar
						totalDue={data.totalDue}
						totalNew={data.totalNew}
						totalLearning={data.totalLearning}
						estimatedMinutes={data.estimatedTotalMinutes}
						progress={data.todayProgress}
					/>
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
							ariaLabel="Search notes or projects"
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
							showArchived={showArchived.value}
							onToggleArchived={() => {
								showArchived.value = !showArchived.value;
							}}
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
			<BottomActionBar />
		</div>
	);
}
