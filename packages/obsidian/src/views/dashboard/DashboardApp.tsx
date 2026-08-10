import { type ReadonlySignal, useSignal } from "@preact/signals";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";

import { aggregateDashboardData } from "@true-recall/core/helpers/note-aggregation";
import { computePriority } from "@true-recall/core/helpers/note-priority";
import { estimateStudyMinutes } from "@true-recall/core/helpers/time-estimate";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { scoreRModeCard } from "@true-recall/core/services/review/retrievability-queue";
import type {
	CardSchedulingMeta,
	TrueRecallSettings,
} from "@true-recall/core/types";

import { AppNavBar } from "@true-recall/obsidian/components";
import { SearchCombobox } from "@true-recall/obsidian/components/SearchCombobox";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { computeActionableSessionSnapshot } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";
import { BottomActionBar } from "@true-recall/obsidian/features/study/ui/dashboard/components/BottomActionBar";
import { CustomStudyTab } from "@true-recall/obsidian/features/study/ui/dashboard/components/CustomStudyTab";
import { DashboardTabs } from "@true-recall/obsidian/features/study/ui/dashboard/components/DashboardTabs";
import { NoteList } from "@true-recall/obsidian/features/study/ui/dashboard/components/NoteList";
import { OrphanedTab } from "@true-recall/obsidian/features/study/ui/dashboard/components/OrphanedTab";
import { ProjectsTab } from "@true-recall/obsidian/features/study/ui/dashboard/components/ProjectsTab";
import { RecentlyStudiedBar } from "@true-recall/obsidian/features/study/ui/dashboard/components/RecentlyStudiedBar";
import { TodayActionBar } from "@true-recall/obsidian/features/study/ui/dashboard/components/TodayActionBar";
import { aggregateProjectData } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/project-aggregation";
import { projectMatchesSearch } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/project-tree-flatten";
import { useDragAutoScroll } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/use-drag-auto-scroll";
import type {
	DashboardAggregation,
	DashboardTab,
} from "@true-recall/obsidian/features/study/ui/dashboard/types";
import { filterActiveCards } from "@true-recall/obsidian/features/study/ui/review/helpers/session-helpers";
import { PresetOptionsModal } from "@true-recall/obsidian/modals/shared/PresetOptionsModal";
import { CreateProjectModal } from "@true-recall/obsidian/modals/study/CreateProjectModal";
import { useGatedComputed, usePlugin } from "@true-recall/obsidian/preact";

import { HeatmapWidget } from "@true-recall/plugins/dashboard-codeblock/analytics/HeatmapWidget";

// While the dashboard is visible, Q.ALL_META changes (every review grade)
// recompute the aggregation at most this often; while hidden, not at all.
const RECOMPUTE_THROTTLE_MS = 2000;
const MINUTE_MS = 60_000;

interface DashboardAppProps {
	isViewVisible: ReadonlySignal<boolean>;
}

export function DashboardApp({ isViewVisible }: DashboardAppProps) {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);
	const settingsSignal = useQuery<TrueRecallSettings>(Q.SETTINGS);
	const archivedSourceUidsSignal = useQuery<ReadonlySet<string>>(
		Q.ARCHIVED_UIDS,
	);
	const activeTab = useSignal<DashboardTab>("projects");
	const searchQuery = useSignal("");
	const minuteBucket = useSignal(Math.floor(Date.now() / MINUTE_MS));
	const isVisible = isViewVisible.value;

	// Retrievability changes with time even when no card metadata changes. Keep
	// the dashboard honest without waking a hidden view every minute.
	useEffect(() => {
		if (!isVisible) return;
		minuteBucket.value = Math.floor(Date.now() / MINUTE_MS);
		const timer = window.setInterval(() => {
			minuteBucket.value = Math.floor(Date.now() / MINUTE_MS);
		}, MINUTE_MS);
		return () => window.clearInterval(timer);
	}, [isVisible, minuteBucket]);

	const now = useMemo(
		() => new Date(minuteBucket.value * MINUTE_MS),
		[minuteBucket.value],
	);

	const statsCalculator = useMemo(() => {
		const calc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
			plugin.settings.dayStartHour,
		);
		calc.setSqliteStore(plugin.cardStore);
		return calc;
	}, [plugin]);

	const showArchived = useSignal(false);

	const _settings = settingsSignal.value;

	// One gated snapshot for all card-derived data: while this leaf is hidden
	// the hot signals are not even subscribed, so grading in the review view
	// no longer re-renders or recomputes the dashboard aggregation. Downstream
	// useMemos stay stable because both references are frozen together.
	const { allCards, archived } = useGatedComputed(
		() => ({
			allCards: [...allMeta.value.values()],
			archived: archivedSourceUidsSignal.value,
		}),
		() => [allMeta.value, archivedSourceUidsSignal.value],
		{ isVisible: isViewVisible, throttleMs: RECOMPUTE_THROTTLE_MS },
	);

	const cachedActiveCards = useMemo(
		() =>
			filterActiveCards(allCards, {
				archivedSourceUids: new Set(archived),
			}),
		[allCards, archived],
	);

	const data = useMemo((): DashboardAggregation => {
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
		const cardsByNoteName = new Map<string, typeof cachedActiveCards>();
		for (const card of cachedActiveCards) {
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

		const rMode = plugin.settings.rMode;
		const retention = plugin.settings.fsrsRequestRetention;
		const presetCache = new Map<
			string,
			ReturnType<typeof plugin.presetService.getDefaultPreset>
		>();
		const rModeCardOptions = {
			ceiling: Math.min(0.999, retention + rMode.ceilingOffset),
			comfortFloor: retention,
			resolveCardOptions: (card: CardSchedulingMeta) => {
				const key = card.sourceUid ?? card.id;
				let preset = presetCache.get(key);
				if (!preset) {
					preset = plugin.presetService.resolvePresetForCard(card);
					presetCache.set(key, preset);
				}
				return {
					comfortFloor: preset.requestRetention,
					ceiling: Math.min(
						0.999,
						preset.requestRetention + rMode.ceilingOffset,
					),
					presetSettings: plugin.presetService.toFSRSSettings(preset),
				};
			},
		};

		const raw = aggregateDashboardData({
			allCards,
			streakCurrent: streakInfo.current,
			todaySummary,
			newCardsCap: plugin.settings.newCardsPerDay,
			reviewsCap: plugin.settings.reviewsPerDay,
			archivedSourceUids: showArchived.value ? undefined : archived,
			retrievability: rMode.enabled
				? {
						getScore: (card) =>
							scoreRModeCard(card, plugin.fsrsService, rModeCardOptions, now),
						urgentBelow: rMode.urgentBelow,
					}
				: undefined,
			now,
		});

		const globalSnapshot = computeActionableSessionSnapshot(
			snapshotDeps,
			{ schedulingMode: rMode.enabled ? "retrievability" : "due" },
			{ cache: snapshotCache, activeCards: cachedActiveCards },
		);

		const actionableNotes = raw.notes.map((note) => {
			const isArchived = note.path
				? plugin.hierarchyService.isNoteArchived(note.path)
				: false;
			if (isArchived) return note;

			const scopedActiveCards = cardsByNoteName.get(note.name) ?? [];
			const noteSnapshot = computeActionableSessionSnapshot(
				snapshotDeps,
				{
					sourceNoteFilter: note.name,
					ignoreDailyLimits: plugin.settings.ignoreDailyLimitsForNoteStudy,
					schedulingMode: rMode.enabled ? "retrievability" : "due",
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
			totalLearningPending: globalSnapshot.counts.learningPending,
			estimatedTotalMinutes: estimateStudyMinutes(
				globalSnapshot.counts.due,
				globalSnapshot.counts.new,
				globalSnapshot.counts.learning,
			),
		};
	}, [
		allCards,
		archived,
		cachedActiveCards,
		statsCalculator,
		plugin,
		showArchived.value,
		now,
	]);

	const visibleNotes = useMemo(() => {
		if (showArchived.value) return data.notes;

		return data.notes.filter((note) => {
			if (!note.path) return true;
			return !plugin.hierarchyService.isNoteArchived(note.path);
		});
	}, [data.notes, plugin, showArchived.value]);

	const projectData = useMemo(() => {
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
				activeCards: cachedActiveCards,
				metadataCache: plugin.app.metadataCache,
			},
			now,
		});
	}, [
		plugin,
		visibleNotes,
		showArchived.value,
		allCards,
		archived,
		cachedActiveCards,
		now,
	]);

	const enrichedNotes = useMemo(() => {
		return visibleNotes.map((note) => {
			const projects = projectData.noteProjectMap.get(note.name) ?? [];

			const preset = note.path
				? plugin.presetService.resolvePresetChain(note.path).effective.preset
				: null;

			const archived = note.path
				? plugin.hierarchyService.isNoteArchived(note.path)
				: false;

			return {
				...note,
				projects,
				presetName: preset?.name,
				archived,
			};
		});
	}, [visibleNotes, projectData.noteProjectMap, plugin]);

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

	const handleStudyNote = (
		noteName: string,
		projectPath?: string,
		rModeTargetCount?: number,
	) => {
		void plugin.startReview({
			mode: "notes",
			noteNames: [noteName],
			projectPath,
			rModeTargetCount,
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

	const onScroll = useCallback(
		(e: Event) => {
			scrollTop.value = (e.currentTarget as HTMLDivElement).scrollTop;
		},
		[scrollTop],
	);

	const handleCreateProject = useCallback(async () => {
		const modal = new CreateProjectModal(
			plugin.app,
			plugin.settings.defaultProjectFolder,
		);
		const result = await modal.openAndWait();
		if (result.cancelled) return;
		await plugin.projectManagement.createProjectWithChildren(
			result.name,
			result.folder,
			[],
		);
	}, [plugin]);

	const handleTabChange = (tab: DashboardTab) => {
		activeTab.value = tab;
		scrollTop.value = 0;
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop = 0;
		}
	};

	useEffect(() => {
		if (activeTab.value === "orphaned" && data.orphanedCards.total === 0) {
			activeTab.value = "projects";
		}
	}, [data.orphanedCards.total, activeTab]);

	return (
		<div class="ep-dashboard-container ep:flex ep:flex-col ep:h-full">
			<AppNavBar activeItem="dashboard" />
			<div
				ref={scrollContainerRef}
				class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto"
				onScroll={onScroll}
			>
				<div class="ep:p-3 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:gap-3 ep:min-h-full">
					{_settings.showDashboardHeader && (
						<>
							<TodayActionBar
								totalDue={data.totalDue}
								totalPool={data.totalPool}
								totalNew={data.totalNew}
								totalLearning={data.totalLearning}
								estimatedMinutes={data.estimatedTotalMinutes}
								progress={data.todayProgress}
							/>

							{projectData.recentlyStudied.length > 0 && (
								<RecentlyStudiedBar notes={projectData.recentlyStudied} />
							)}
						</>
					)}

					{(activeTab.value === "projects" || activeTab.value === "notes") && (
						<SearchCombobox
							value={searchQuery.value}
							placeholder="Search notes or projects…"
							ariaLabel="Search notes or projects"
							onChange={(q) => {
								searchQuery.value = q;
							}}
						/>
					)}

					<DashboardTabs
						activeTab={activeTab.value}
						onTabChange={handleTabChange}
						projectCount={filteredCounts.projects}
						notesCount={filteredCounts.notes}
						customCount={_settings.temporaryCustomStudyDecks.length}
						orphanedCount={filteredCounts.orphaned}
						showArchived={showArchived.value}
						onToggleArchived={() => {
							showArchived.value = !showArchived.value;
						}}
						onCreateProject={() => void handleCreateProject()}
						onCreateCustomSession={() => void plugin.openCustomStudyModal()}
					/>

					<div class="ep:flex ep:flex-col ep:flex-1">
						<div class="ep:flex-1">
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

							{activeTab.value === "custom" && (
								<CustomStudyTab decks={_settings.temporaryCustomStudyDecks} />
							)}

							{activeTab.value === "orphaned" && (
								<OrphanedTab stats={data.orphanedCards} />
							)}
						</div>

						<div class="ep:mt-3">
							<HeatmapWidget source="months: 0" isViewVisible={isViewVisible} />
						</div>
					</div>
				</div>
			</div>
			<BottomActionBar />
		</div>
	);
}
