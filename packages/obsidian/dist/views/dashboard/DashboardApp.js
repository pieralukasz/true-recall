import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSignal } from "@preact/signals";
import { aggregateDashboardData } from "@true-recall/core/helpers/note-aggregation";
import { computePriority } from "@true-recall/core/helpers/note-priority";
import { estimateStudyMinutes } from "@true-recall/core/helpers/time-estimate";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { AppNavBar } from "@true-recall/obsidian/components";
import { SearchCombobox } from "@true-recall/obsidian/components/SearchCombobox";
import { HeatmapWidget } from "@true-recall/obsidian/editor/study/widgets/analytics/HeatmapWidget";
import { computeActionableSessionSnapshot } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";
import { BottomActionBar } from "@true-recall/obsidian/features/study/ui/dashboard/components/BottomActionBar";
import { DashboardTabs } from "@true-recall/obsidian/features/study/ui/dashboard/components/DashboardTabs";
import { NoteList } from "@true-recall/obsidian/features/study/ui/dashboard/components/NoteList";
import { OrphanedTab } from "@true-recall/obsidian/features/study/ui/dashboard/components/OrphanedTab";
import { ProjectsTab } from "@true-recall/obsidian/features/study/ui/dashboard/components/ProjectsTab";
import { RecentlyStudiedBar } from "@true-recall/obsidian/features/study/ui/dashboard/components/RecentlyStudiedBar";
import { TodayActionBar } from "@true-recall/obsidian/features/study/ui/dashboard/components/TodayActionBar";
import { aggregateProjectData } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/project-aggregation";
import { projectMatchesSearch } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/project-tree-flatten";
import { useDragAutoScroll } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/use-drag-auto-scroll";
import { filterActiveCards } from "@true-recall/obsidian/features/study/ui/review/helpers/session-helpers";
import { PresetOptionsModal } from "@true-recall/obsidian/modals/shared/PresetOptionsModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import { allCardsArray, archivedSourceUids as archivedSourceUidsSignal, hierarchyVersion, pluginSettings, } from "@true-recall/obsidian/services/reactive-card-store";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
export function DashboardApp() {
    const plugin = usePlugin();
    const activeTab = useSignal("projects");
    const searchQuery = useSignal("");
    const statsCalculator = useMemo(() => {
        const calc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence, plugin.settings.dayStartHour);
        calc.setSqliteStore(plugin.cardStore);
        return calc;
    }, [plugin]);
    const showArchived = useSignal(false);
    // Signal reads — subscribe component to reactive data changes
    const allCards = allCardsArray.value;
    const _settings = pluginSettings.value;
    const archived = archivedSourceUidsSignal.value;
    const _hv = hierarchyVersion.value;
    const cachedActiveCards = useMemo(() => filterActiveCards(allCards, {
        archivedSourceUids: new Set(archived),
    }), [allCards, archived]);
    const data = useMemo(() => {
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
        const cardsByNoteName = new Map();
        for (const card of cachedActiveCards) {
            const noteName = card.sourceNoteName;
            if (!noteName)
                continue;
            const bucket = cardsByNoteName.get(noteName);
            if (bucket) {
                bucket.push(card);
            }
            else {
                cardsByNoteName.set(noteName, [card]);
            }
        }
        const snapshotCache = new Map();
        const raw = aggregateDashboardData({
            allCards,
            streakCurrent: streakInfo.current,
            todaySummary,
            newCardsCap: plugin.settings.newCardsPerDay,
            reviewsCap: plugin.settings.reviewsPerDay,
            archivedSourceUids: showArchived.value ? undefined : archived,
        });
        const globalSnapshot = computeActionableSessionSnapshot(snapshotDeps, {}, { cache: snapshotCache, activeCards: cachedActiveCards });
        const actionableNotes = raw.notes.map((note) => {
            var _a;
            const scopedActiveCards = (_a = cardsByNoteName.get(note.name)) !== null && _a !== void 0 ? _a : [];
            const noteSnapshot = computeActionableSessionSnapshot(snapshotDeps, {
                sourceNoteFilter: note.name,
                ignoreDailyLimits: plugin.settings.ignoreDailyLimitsForNoteStudy,
            }, { cache: snapshotCache, activeCards: scopedActiveCards });
            const due = noteSnapshot.counts.due;
            const newCount = noteSnapshot.counts.new;
            const learning = noteSnapshot.counts.learning;
            return Object.assign(Object.assign({}, note), { due,
                newCount,
                learning, estimatedMinutes: estimateStudyMinutes(due, newCount, learning), priority: computePriority(Object.assign(Object.assign({}, note), { due,
                    newCount,
                    learning })) });
        });
        return Object.assign(Object.assign({}, raw), { notes: actionableNotes, totalDue: globalSnapshot.counts.due, totalNew: globalSnapshot.counts.new, totalLearning: globalSnapshot.counts.learning, estimatedTotalMinutes: estimateStudyMinutes(globalSnapshot.counts.due, globalSnapshot.counts.new, globalSnapshot.counts.learning) });
    }, [
        allCards,
        _settings,
        archived,
        cachedActiveCards,
        statsCalculator,
        plugin,
        showArchived.value,
    ]);
    const visibleNotes = useMemo(() => {
        if (showArchived.value)
            return data.notes;
        return data.notes.filter((note) => {
            if (!note.path)
                return true;
            return !isNoteUnderArchivedHierarchy(note.path, plugin.hierarchyService);
        });
    }, [data.notes, plugin, showArchived.value, _hv]);
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
        });
    }, [plugin, visibleNotes, showArchived.value]);
    const enrichedNotes = useMemo(() => {
        return visibleNotes.map((note) => {
            var _a;
            const projects = (_a = projectData.noteProjectMap.get(note.name)) !== null && _a !== void 0 ? _a : [];
            const preset = note.path
                ? plugin.presetService.resolvePresetChain(note.path).effective.preset
                : null;
            const archived = showArchived.value && note.path
                ? plugin.hierarchyService.isNoteArchived(note.path)
                : undefined;
            return Object.assign(Object.assign(Object.assign({}, note), { projects, presetName: preset === null || preset === void 0 ? void 0 : preset.name }), (archived ? { archived } : {}));
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
    const handleStudyNote = (noteName, projectPath) => {
        void plugin.openReviewViewWithFilters({
            sourceNoteFilter: noteName,
            projectPath,
            ignoreDailyLimits: plugin.settings.ignoreDailyLimitsForNoteStudy,
        });
    };
    const handlePresetClick = useCallback((path) => {
        var _a;
        if (!path)
            return;
        const chain = plugin.presetService.resolvePresetChain(path);
        const presetId = chain.effective.preset.id;
        const name = (_a = path.split("/").pop()) === null || _a === void 0 ? void 0 : _a.replace(/\.md$/, "");
        new PresetOptionsModal(plugin.app, plugin, {
            initialPresetId: presetId,
            contextPath: path,
            contextName: name,
        }).open();
    }, [plugin]);
    const scrollContainerRef = useRef(null);
    const scrollTop = useSignal(0);
    useDragAutoScroll(scrollContainerRef);
    const onScroll = useCallback((e) => {
        scrollTop.value = e.currentTarget.scrollTop;
    }, []);
    const handleTabChange = (tab) => {
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
    }, [data.orphanedCards.total]);
    return (_jsxs("div", { class: "ep-dashboard-container ep:flex ep:flex-col ep:h-full", children: [_jsx(AppNavBar, { activeItem: "dashboard" }), _jsx("div", { ref: scrollContainerRef, class: "ep:flex-1 ep:min-h-0 ep:overflow-y-auto", onScroll: onScroll, children: _jsxs("div", { class: "ep:p-3 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:gap-3 ep:min-h-full", children: [_jsx(TodayActionBar, { totalDue: data.totalDue, totalNew: data.totalNew, totalLearning: data.totalLearning, estimatedMinutes: data.estimatedTotalMinutes, progress: data.todayProgress }), projectData.recentlyStudied.length > 0 && (_jsx(RecentlyStudiedBar, { notes: projectData.recentlyStudied })), _jsx(SearchCombobox, { value: searchQuery.value, placeholder: "Search notes or projects...", ariaLabel: "Search notes or projects", onChange: (q) => {
                                searchQuery.value = q;
                            } }), _jsx(DashboardTabs, { activeTab: activeTab.value, onTabChange: handleTabChange, projectCount: filteredCounts.projects, notesCount: filteredCounts.notes, orphanedCount: filteredCounts.orphaned, showArchived: showArchived.value, onToggleArchived: () => {
                                showArchived.value = !showArchived.value;
                            } }), _jsxs("div", { class: "ep:flex ep:flex-col ep:flex-1", children: [_jsxs("div", { class: "ep:flex-1", children: [activeTab.value === "projects" && (_jsx(ProjectsTab, { projects: projectData.projects, searchQuery: searchQuery.value, scrollContainerRef: scrollContainerRef, scrollTop: scrollTop, onStudyNote: handleStudyNote, onPresetClick: handlePresetClick })), activeTab.value === "notes" && (_jsx(NoteList, { notes: enrichedNotes, searchQuery: searchQuery.value, scrollContainerRef: scrollContainerRef, scrollTop: scrollTop, onPresetClick: handlePresetClick })), activeTab.value === "orphaned" && (_jsx(OrphanedTab, { stats: data.orphanedCards }))] }), _jsx("div", { class: "ep:mt-3", children: _jsx(HeatmapWidget, { source: "months: 0" }) })] })] }) }), _jsx(BottomActionBar, {})] }));
}
function isNoteUnderArchivedHierarchy(notePath, hierarchyService) {
    if (hierarchyService.isNoteArchived(notePath))
        return true;
    // Walk up through parent projects, including nested parents.
    const stack = [...hierarchyService.getParentsForNote(notePath)];
    const visited = new Set();
    while (stack.length > 0) {
        const parentPath = stack.pop();
        if (!parentPath || visited.has(parentPath))
            continue;
        visited.add(parentPath);
        if (hierarchyService.isProjectArchived(parentPath))
            return true;
        const grandParents = hierarchyService.getParentsForNote(parentPath);
        for (const gp of grandParents)
            stack.push(gp);
    }
    return false;
}
