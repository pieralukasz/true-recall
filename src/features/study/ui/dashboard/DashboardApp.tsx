import type { HierarchyService } from "@features/core/services/hierarchy.service";
import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { computeActionableSessionSnapshot } from "@features/study/services/actionable-session-snapshot.service";
import { filterActiveCards } from "@features/study/ui/review/helpers/session-helpers";
import { useComputed, useSignal } from "@preact/signals";
import {
	allCardsArray,
	archivedSourceUids as archivedSourceUidsSignal,
	pluginSettings,
} from "@shared/services/reactive-card-store";
import { AppNavBar } from "@shared/ui/components";
import { SearchCombobox } from "@shared/ui/components/SearchCombobox";
import { PresetOptionsModal } from "@shared/ui/modals/PresetOptionsModal";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useMemo, useRef } from "preact/hooks";
import { HeatmapWidget } from "../editor/widgets/analytics/HeatmapWidget";
import { BottomActionBar } from "./components/BottomActionBar";
import { DashboardTabs } from "./components/DashboardTabs";
import { NoteList } from "./components/NoteList";
import { OrphanedTab } from "./components/OrphanedTab";
import { ProjectsTab } from "./components/ProjectsTab";
import { RecentlyStudiedBar } from "./components/RecentlyStudiedBar";
import { TodayActionBar } from "./components/TodayActionBar";
import { aggregateDashboardData } from "./helpers/note-aggregation";
import { computePriority } from "./helpers/note-priority";
import { aggregateProjectData } from "./helpers/project-aggregation";
import { projectMatchesSearch } from "./helpers/project-tree-flatten";
import { estimateStudyMinutes } from "./helpers/time-estimate";
import { useDragAutoScroll } from "./helpers/use-drag-auto-scroll";
import { useInitialMount } from "./helpers/use-initial-mount";
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

	const cachedActiveCards = useComputed(() => {
		const allCards = allCardsArray.value;
		const archived = archivedSourceUidsSignal.value;
		return filterActiveCards(allCards, {
			archivedSourceUids: new Set(archived),
		});
	});

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
		const activeCards = cachedActiveCards.value;
		const cardsByNoteName = new Map<string, typeof activeCards>();
		for (const card of activeCards) {
			const noteName = card.sourceNoteName;
			if (!noteName) continue;
			const bucket = cardsByNoteName.get(noteName);
			if (bucket) {
				bucket.push(card);
			} else {
				cardsByNoteName.set(noteName, [card]);
			}
		}
		const snapshotCache = new Map<
			string,
			ReturnType<typeof computeActionableSessionSnapshot>
		>();

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
			const scopedActiveCards = cardsByNoteName.get(note.name) ?? [];
			const noteSnapshot = computeActionableSessionSnapshot(
				snapshotDeps,
				{
					sourceNoteFilter: note.name,
					ignoreDailyLimits: plugin.settings.ignoreDailyLimitsForNoteStudy,
				},
				{ cache: snapshotCache, activeCards: scopedActiveCards },
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
			return !isNoteUnderArchivedHierarchy(
				note.path,
				plugin.hierarchyService,
			);
		});
	}, [data.notes, plugin, showArchived.value]);

	const projectData = useMemo(() => {
		const allCards = allCardsArray.value;
		const archived = archivedSourceUidsSignal.value;
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
				activeCards: cachedActiveCards.value,
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

	const filteredCounts = useMemo(() => {
		const orphaned = data.orphanedCards.total;
		const q = searchQuery.value.toLowerCase().trim();
		if (!q) {
			return {
				projects: projectData.projects.length,
				notes: enrichedNotes.length,
				orphaned,
			};
		}
		return {
			projects: projectData.projects.filter((p) => projectMatchesSearch(p, q))
				.length,
			notes: enrichedNotes.filter((n) => n.name.toLowerCase().includes(q))
				.length,
			orphaned,
		};
	}, [
		searchQuery.value,
		projectData.projects,
		enrichedNotes,
		data.orphanedCards.total,
	]);

	const handleStudyNote = (noteName: string, projectPath?: string) => {
		void plugin.openReviewViewWithFilters({
			sourceNoteFilter: noteName,
			projectPath,
			ignoreDailyLimits: plugin.settings.ignoreDailyLimitsForNoteStudy,
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
		scrollTop.value = 0;
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop = 0;
		}
	};

	if (activeTab.value === "orphaned" && data.orphanedCards.total === 0) {
		activeTab.value = "projects";
	}

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
							<RecentlyStudiedBar notes={projectData.recentlyStudied} />
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
						/>
					</div>

					<div {...sectionProps()}>
						<DashboardTabs
							activeTab={activeTab.value}
							onTabChange={handleTabChange}
							projectCount={filteredCounts.projects}
							notesCount={filteredCounts.notes}
							orphanedCount={filteredCounts.orphaned}
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
								initialMount.current ? { "--section-index": si++ } : undefined
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
									scrollContainerRef={scrollContainerRef}
									scrollTop={scrollTop}
									onPresetClick={handlePresetClick}
								/>
							)}

							{activeTab.value === "orphaned" && (
								<OrphanedTab stats={data.orphanedCards} />
							)}
						</div>

						<div
							class={`ep:mt-3${initialMount.current ? " ep-section-enter" : ""}`}
							style={
								initialMount.current ? { "--section-index": si++ } : undefined
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

function isNoteUnderArchivedHierarchy(
	notePath: string,
	hierarchyService: HierarchyService,
): boolean {
	if (hierarchyService.isNoteArchived(notePath)) return true;

	// Walk up through parent projects, including nested parents.
	const stack = [...hierarchyService.getParentsForNote(notePath)];
	const visited = new Set<string>();

	while (stack.length > 0) {
		const parentPath = stack.pop();
		if (!parentPath || visited.has(parentPath)) continue;
		visited.add(parentPath);

		if (hierarchyService.isProjectArchived(parentPath)) return true;

		const grandParents = hierarchyService.getParentsForNote(parentPath);
		for (const gp of grandParents) stack.push(gp);
	}

	return false;
}
