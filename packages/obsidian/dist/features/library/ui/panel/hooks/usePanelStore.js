import { cards } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useEffect, useMemo, useState } from "preact/hooks";
const DEFAULT_STATE = {
    currentFile: null,
    flashcardInfo: null,
    status: "idle",
    viewMode: "list",
    uncollectedCount: 0,
    isFollowingReview: false,
    isAddCardExpanded: false,
    selectionMode: "idle",
    selectedCardIds: new Set(),
    expandedCardIds: new Set(),
    searchQuery: "",
    hasHighlights: false,
};
function buildPanelState(p) {
    return {
        currentFile: p.currentFile,
        flashcardInfo: p.flashcardInfo,
        status: p.status,
        viewMode: p.viewMode,
        uncollectedCount: p.uncollectedCount,
        isFollowingReview: p.isFollowingReview,
        isAddCardExpanded: p.isAddCardExpanded,
        selectionMode: p.selectionMode,
        selectedCardIds: p.selectedCardIds,
        expandedCardIds: p.expandedCardIds,
        searchQuery: p.searchQuery,
        hasHighlights: p.hasHighlights,
    };
}
export function usePanelStore() {
    const plugin = usePlugin();
    // ── Panel API ──
    const store = plugin.store;
    if (!store)
        throw new Error("Store not initialized");
    const panel = store.getState().panel;
    // ── Panel state subscription ──
    const [state, setState] = useState(() => {
        const p = store.getState().panel;
        return p ? buildPanelState(p) : DEFAULT_STATE;
    });
    useEffect(() => {
        const unsub = store.subscribe((s) => s.panel, () => {
            const p = store.getState().panel;
            if (p)
                setState(buildPanelState(p));
        });
        return unsub;
    }, [store]);
    // ── Cards enriched with FSRS scheduling data ──
    const cardsRef = cards.value;
    const cardsWithFsrs = useMemo(() => {
        var _a;
        if (!((_a = state.flashcardInfo) === null || _a === void 0 ? void 0 : _a.flashcards))
            return [];
        if (!plugin.flashcardManager.hasStore())
            return [];
        const cardIds = state.flashcardInfo.flashcards.map((c) => c.id);
        return plugin.flashcardManager.getCardsByIds(cardIds);
    }, [state.flashcardInfo, plugin, cardsRef]);
    return Object.assign(Object.assign({}, state), { cardsWithFsrs,
        panel });
}
