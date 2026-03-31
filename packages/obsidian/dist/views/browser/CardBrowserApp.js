import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSignal } from "@preact/signals";
import { DuplicateQuestionError } from "@true-recall/core/flashcard/data/card-repository.service";
import { parseSearchQuery } from "@true-recall/core/helpers/search-parser";
import { CardBrowserQueryService } from "@true-recall/core/services/browser/card-browser-query.service";
import { AppNavBar } from "@true-recall/obsidian/components";
import { BrowserSidebar } from "@true-recall/obsidian/features/library/ui/browser/components/BrowserSidebar";
import { BrowserToolbar } from "@true-recall/obsidian/features/library/ui/browser/components/BrowserToolbar";
import { BulkActionsBar } from "@true-recall/obsidian/features/library/ui/browser/components/BulkActionsBar";
import { CardPreview } from "@true-recall/obsidian/features/library/ui/browser/components/CardPreview";
import { CardTable } from "@true-recall/obsidian/features/library/ui/browser/components/CardTable";
import { createBrowserSuggestionProvider } from "@true-recall/obsidian/features/library/ui/browser/helpers/browser-suggestions";
import { DEFAULT_VISIBLE_KEYS } from "@true-recall/obsidian/features/library/ui/browser/helpers/column-defs";
import { BROWSER_PAGE_SIZE, getBrowserQueryResetKey, } from "@true-recall/obsidian/features/library/ui/browser/helpers/infinite-scroll";
import { useKeyboardNav } from "@true-recall/obsidian/features/library/ui/browser/hooks/useKeyboardNav";
import { EMPTY_FILTER, } from "@true-recall/obsidian/features/library/ui/browser/types";
import { notifyDuplicateError } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-helpers";
import { useQuerySignal } from "@true-recall/obsidian/hooks/use-query";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { QK } from "@true-recall/obsidian/services/query-keys";
import { pluginSettings } from "@true-recall/obsidian/services/reactive-card-store";
import { pushDeleteUndo } from "@true-recall/obsidian/services/undo.service";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
const PAGE_SIZE = BROWSER_PAGE_SIZE;
export function CardBrowserApp({ filterSourceUid, filterOrphaned, }) {
    var _a, _b, _c, _d;
    const plugin = usePlugin();
    const app = useApp();
    const searchText = useSignal("");
    const stateFilters = useSignal([]);
    const sort = useSignal({ column: "due", direction: "asc" });
    const selectedIds = useSignal(new Set());
    const previewCard = useSignal(null);
    const sidebarVisible = useSignal(true);
    const showArchived = useSignal(false);
    const visibleColumns = useSignal(DEFAULT_VISIBLE_KEYS);
    const sidebarFilter = useSignal(EMPTY_FILTER);
    const loadedLimit = useSignal(PAGE_SIZE);
    const scrollContainerRef = useRef(null);
    useEffect(() => {
        if (!filterSourceUid)
            return;
        const uid = filterSourceUid.value;
        if (!uid)
            return;
        sidebarFilter.value = Object.assign(Object.assign({}, EMPTY_FILTER), { sourceUids: [uid] });
        filterSourceUid.value = null;
    }, [filterSourceUid === null || filterSourceUid === void 0 ? void 0 : filterSourceUid.value]);
    useEffect(() => {
        if (!filterOrphaned)
            return;
        if (!filterOrphaned.value)
            return;
        sidebarFilter.value = Object.assign(Object.assign({}, EMPTY_FILTER), { orphanedOnly: true });
        filterOrphaned.value = false;
    }, [filterOrphaned === null || filterOrphaned === void 0 ? void 0 : filterOrphaned.value]);
    const queryService = useMemo(() => new CardBrowserQueryService(plugin.cardStore, plugin.frontmatterIndex, plugin.hierarchyService), [plugin]);
    // Signal reads — subscribe component to reactive data changes
    const allCardsSignal = useQuerySignal(QK.ALL_CARDS);
    const allCards = allCardsSignal.value;
    const _settings = pluginSettings.value;
    const searchTextVal = searchText.value;
    const stateFiltersVal = stateFilters.value;
    const sidebarFilterVal = sidebarFilter.value;
    const showArchivedVal = showArchived.value;
    const sortVal = sort.value;
    const loadedLimitVal = loadedLimit.value;
    const combinedFilter = useMemo(() => {
        const parsed = parseSearchQuery(searchTextVal);
        return Object.assign(Object.assign({}, parsed), { states: [
                ...parsed.states,
                ...stateFiltersVal,
                ...sidebarFilterVal.states,
            ], sourceUids: [...parsed.sourceUids, ...sidebarFilterVal.sourceUids], cardTypes: [...parsed.cardTypes, ...sidebarFilterVal.cardTypes], createdVia: [...parsed.createdVia, ...sidebarFilterVal.createdVia], negatedStates: [
                ...parsed.negatedStates,
                ...sidebarFilterVal.negatedStates,
            ], showArchived: showArchivedVal, orphanedOnly: parsed.orphanedOnly || sidebarFilterVal.orphanedOnly });
    }, [searchTextVal, stateFiltersVal, sidebarFilterVal, showArchivedVal]);
    const result = useMemo(() => {
        return queryService.query(combinedFilter, sortVal, loadedLimitVal, 0);
    }, [
        allCards,
        _settings,
        queryService,
        combinedFilter,
        sortVal,
        loadedLimitVal,
    ]);
    const queryResetKey = useMemo(() => getBrowserQueryResetKey(combinedFilter, sortVal), [combinedFilter, sortVal]);
    const facetCounts = useMemo(() => queryService.getFacetCounts(showArchivedVal), [allCards, queryService, showArchivedVal]);
    const orphanedCardIds = useMemo(() => queryService.getOrphanedCardIds(), [allCards, queryService]);
    const getSuggestions = useMemo(() => {
        const presetNames = plugin.presetService.getPresets().map((p) => p.name);
        const projectNames = plugin.hierarchyService
            .buildHierarchy()
            .map((n) => n.name)
            .sort();
        return createBrowserSuggestionProvider({
            sourceNotes: facetCounts.sourceNotes,
            presetNames,
            projectNames,
        });
    }, [plugin, facetCounts.sourceNotes]);
    const handleSort = useCallback((column) => {
        sort.value =
            sort.value.column === column
                ? {
                    column,
                    direction: sort.value.direction === "asc" ? "desc" : "asc",
                }
                : { column, direction: "asc" };
    }, []);
    const handleSelect = useCallback((cardId, event) => {
        const next = new Set(selectedIds.value);
        if ((event === null || event === void 0 ? void 0 : event.ctrlKey) || (event === null || event === void 0 ? void 0 : event.metaKey)) {
            if (next.has(cardId))
                next.delete(cardId);
            else
                next.add(cardId);
        }
        else if ((event === null || event === void 0 ? void 0 : event.shiftKey) && result.cards.length > 0) {
            // Range select from last selected to current
            const lastSelected = Array.from(selectedIds.value).pop();
            if (lastSelected) {
                const lastIdx = result.cards.findIndex((c) => c.id === lastSelected);
                const currIdx = result.cards.findIndex((c) => c.id === cardId);
                if (lastIdx >= 0 && currIdx >= 0) {
                    const [from, to] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx];
                    for (let i = from; i <= to; i++) {
                        const c = result.cards[i];
                        if (c)
                            next.add(c.id);
                    }
                }
            }
        }
        else {
            if (next.has(cardId) && next.size === 1) {
                next.clear();
            }
            else {
                next.clear();
                next.add(cardId);
            }
        }
        selectedIds.value = next;
    }, [result.cards]);
    const handlePreview = useCallback((card) => {
        var _a;
        previewCard.value = ((_a = previewCard.value) === null || _a === void 0 ? void 0 : _a.id) === card.id ? null : card;
    }, []);
    const handleContentChange = useCallback((value, field) => {
        const card = previewCard.value;
        if (!card)
            return;
        if (card.cardType === "image-occlusion") {
            notify().warning("Image occlusion cards are edited in the image occlusion editor.");
            return;
        }
        const newQuestion = field === "question" ? value : card.question;
        const newAnswer = field === "answer" ? value : card.answer;
        try {
            plugin.flashcardManager.updateCardContent(card.id, newQuestion, newAnswer);
            previewCard.value = Object.assign(Object.assign({}, card), { question: newQuestion, answer: newAnswer });
        }
        catch (error) {
            if (error instanceof DuplicateQuestionError) {
                notifyDuplicateError(plugin, error, newQuestion);
            }
            else {
                notify().operationFailed("save card", error);
            }
        }
    }, [plugin]);
    const handleSelectAll = useCallback(() => {
        if (selectedIds.value.size === result.cards.length) {
            selectedIds.value = new Set();
        }
        else {
            selectedIds.value = new Set(result.cards.map((c) => c.id));
        }
    }, [result.cards]);
    const handleClearSelection = useCallback(() => {
        selectedIds.value = new Set();
    }, []);
    const handleToggleStateFilter = useCallback((state) => {
        const current = stateFilters.value;
        stateFilters.value = current.includes(state)
            ? current.filter((s) => s !== state)
            : [...current, state];
    }, []);
    const handleRemoveStateFilter = useCallback((state) => {
        stateFilters.value = stateFilters.value.filter((s) => s !== state);
    }, []);
    const handleSidebarFilter = useCallback((partial) => {
        sidebarFilter.value = Object.assign(Object.assign({}, sidebarFilter.value), partial);
    }, []);
    const handleToggleColumn = useCallback((key) => {
        const current = visibleColumns.value;
        visibleColumns.value = current.includes(key)
            ? current.filter((k) => k !== key)
            : [...current, key];
    }, []);
    const handleToggleShowArchived = useCallback(() => {
        showArchived.value = !showArchived.value;
    }, []);
    const hasMore = result.cards.length < result.totalCount;
    const loadMore = useCallback(() => {
        if (!hasMore)
            return;
        loadedLimit.value += PAGE_SIZE;
    }, [hasMore]);
    const handleRemoveOrphanedCards = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const orphanedIds = queryService.getOrphanedCardIds();
        if (orphanedIds.length === 0)
            return;
        const cardWord = orphanedIds.length === 1 ? "card" : "cards";
        const { confirm } = yield import("@true-recall/obsidian/modals/shared/ConfirmModal");
        const confirmed = yield confirm(app, {
            message: `Remove ${orphanedIds.length} orphaned ${cardWord}?`,
        });
        if (!confirmed)
            return;
        const deleteResult = plugin.flashcardManager.removeFlashcardsByIdsWithDetails(orphanedIds);
        if (deleteResult.ok) {
            pushDeleteUndo(plugin, deleteResult);
        }
        notify().cardsDeletedWithUndo(deleteResult.affectedCount, () => {
            var _a;
            void ((_a = plugin.undoService) === null || _a === void 0 ? void 0 : _a.undo());
        });
        const deletedSet = new Set(deleteResult.affectedIds);
        selectedIds.value = new Set([...selectedIds.value].filter((id) => !deletedSet.has(id)));
        if (previewCard.value && deletedSet.has(previewCard.value.id)) {
            previewCard.value = null;
        }
    }), [app, plugin, queryService]);
    const searchInputRef = useRef(null);
    useEffect(() => {
        var _a;
        loadedLimit.value = PAGE_SIZE;
        (_a = scrollContainerRef.current) === null || _a === void 0 ? void 0 : _a.scrollTo({ top: 0 });
    }, [queryResetKey]);
    useKeyboardNav({
        cards: result.cards,
        selectedIds: selectedIds.value,
        previewCardId: (_b = (_a = previewCard.value) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null,
        onSelect: handleSelect,
        onPreview: handlePreview,
        onClearSelection: handleClearSelection,
        onSelectAll: handleSelectAll,
        onFocusSearch: () => { var _a; return (_a = searchInputRef.current) === null || _a === void 0 ? void 0 : _a.focus(); },
    });
    return (_jsxs("div", { class: "ep-card-browser ep:flex ep:flex-col ep:h-full", children: [_jsx(AppNavBar, { activeItem: "browse", collapsible: true }), _jsx(BrowserToolbar, { searchText: searchText.value, onSearchChange: (v) => {
                    searchText.value = v;
                }, stateFilters: stateFilters.value, onToggleStateFilter: handleToggleStateFilter, onRemoveStateFilter: handleRemoveStateFilter, sort: sort.value, totalCount: result.totalCount, showArchived: showArchived.value, onToggleShowArchived: handleToggleShowArchived, sidebarVisible: sidebarVisible.value, onToggleSidebar: () => {
                    sidebarVisible.value = !sidebarVisible.value;
                }, visibleColumns: visibleColumns.value, onToggleColumn: handleToggleColumn, getSuggestions: getSuggestions }), selectedIds.value.size > 0 && (_jsx(BulkActionsBar, { selectedCount: selectedIds.value.size, selectedIds: selectedIds.value, onClearSelection: handleClearSelection, onSelectAll: handleSelectAll, totalCount: result.totalCount })), _jsxs("div", { class: "ep:flex ep:flex-1 ep:min-h-0", children: [sidebarVisible.value && (_jsx(BrowserSidebar, { facetCounts: facetCounts, activeFilter: sidebarFilter.value, onFilterChange: handleSidebarFilter, orphanedCount: orphanedCardIds.length, onRemoveOrphanedCards: handleRemoveOrphanedCards })), _jsx("div", { class: "ep:flex-1 ep:min-w-0 ep:flex ep:flex-col", children: _jsx(CardTable, { cards: result.cards, sort: sort.value, onSort: handleSort, selectedIds: selectedIds.value, onSelect: handleSelect, onPreview: handlePreview, previewCardId: (_d = (_c = previewCard.value) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null, visibleColumns: visibleColumns.value, scrollContainerRef: scrollContainerRef, hasMore: hasMore, onReachEnd: loadMore }) }), previewCard.value && (_jsx(CardPreview, { card: previewCard.value, onClose: () => {
                            previewCard.value = null;
                        }, onContentChange: handleContentChange }))] })] }));
}
