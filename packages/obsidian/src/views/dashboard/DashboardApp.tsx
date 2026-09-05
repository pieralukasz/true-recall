import { type ReadonlySignal, useSignal } from "@preact/signals";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";

import type { TrueRecallSettings } from "@true-recall/core/types";

import { AppNavBar } from "@true-recall/obsidian/components";
import { SearchCombobox } from "@true-recall/obsidian/components/SearchCombobox";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { BottomActionBar } from "@true-recall/obsidian/features/study/ui/dashboard/components/BottomActionBar";
import { CloudSyncConnectBanner } from "@true-recall/obsidian/features/study/ui/dashboard/components/CloudSyncConnectBanner";
import { CustomStudyTab } from "@true-recall/obsidian/features/study/ui/dashboard/components/CustomStudyTab";
import { DashboardTabs } from "@true-recall/obsidian/features/study/ui/dashboard/components/DashboardTabs";
import { NoteList } from "@true-recall/obsidian/features/study/ui/dashboard/components/NoteList";
import { OrphanedTab } from "@true-recall/obsidian/features/study/ui/dashboard/components/OrphanedTab";
import { ProIntroBanner } from "@true-recall/obsidian/features/study/ui/dashboard/components/ProIntroBanner";
import { ProjectsTab } from "@true-recall/obsidian/features/study/ui/dashboard/components/ProjectsTab";
import { RecentlyStudiedBar } from "@true-recall/obsidian/features/study/ui/dashboard/components/RecentlyStudiedBar";
import { SyncStatusChip } from "@true-recall/obsidian/features/study/ui/dashboard/components/SyncStatusChip";
import { TodayActionBar } from "@true-recall/obsidian/features/study/ui/dashboard/components/TodayActionBar";
import { projectMatchesSearch } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/project-tree-flatten";
import { useDashboardData } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/use-dashboard-data";
import { useDragAutoScroll } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/use-drag-auto-scroll";
import type { DashboardTab } from "@true-recall/obsidian/features/study/ui/dashboard/types";
import { PresetOptionsModal } from "@true-recall/obsidian/modals/shared/PresetOptionsModal";
import { CreateProjectModal } from "@true-recall/obsidian/modals/study/CreateProjectModal";
import { usePlugin } from "@true-recall/obsidian/preact";

import { HeatmapWidget } from "@true-recall/plugins/dashboard-codeblock/analytics/HeatmapWidget";

interface DashboardAppProps {
	isViewVisible: ReadonlySignal<boolean>;
}

export function DashboardApp({ isViewVisible }: DashboardAppProps) {
	const plugin = usePlugin();
	const settingsSignal = useQuery<TrueRecallSettings>(Q.SETTINGS);
	const activeTab = useSignal<DashboardTab>("projects");
	const searchQuery = useSignal("");
	const showArchived = useSignal(false);

	const _settings = settingsSignal.value;

	const {
		data,
		notes: enrichedNotes,
		projectData,
	} = useDashboardData({ isViewVisible, showArchived: showArchived.value });

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
					<ProIntroBanner settings={_settings} />
					<CloudSyncConnectBanner />

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

						<div class="ep:mt-2">
							<SyncStatusChip />
						</div>
					</div>
				</div>
			</div>
			<BottomActionBar />
		</div>
	);
}
