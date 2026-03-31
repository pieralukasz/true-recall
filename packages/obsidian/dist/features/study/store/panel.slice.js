import { createSelectionActions, toggleSetItem, } from "@true-recall/obsidian/store/helpers/slice-helpers";
function createInitialState() {
    return {
        status: "none",
        viewMode: "list",
        currentFile: null,
        flashcardInfo: null,
        error: null,
        renderVersion: 0,
        sourceNoteName: null,
        uncollectedCount: 0,
        selectionMode: "normal",
        selectedCardIds: new Set(),
        expandedCardIds: new Set(),
        searchQuery: "",
        isAddCardExpanded: false,
        isFollowingReview: false,
        reviewSourceNotePath: null,
        hasHighlights: false,
    };
}
export function createPanelSlice(set, get, _deps) {
    const initial = createInitialState();
    const slice = Object.assign(Object.assign(Object.assign(Object.assign({}, initial), { setState: (partial) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), partial),
            }));
        }, reset: () => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), createInitialState()),
            }));
        }, incrementRenderVersion: () => {
            const newVersion = get().panel.renderVersion + 1;
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { renderVersion: newVersion }),
            }));
            return newVersion;
        }, isCurrentRender: (version) => {
            return get().panel.renderVersion === version;
        }, setCurrentFile: (file) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { currentFile: file, status: "none", viewMode: "list", flashcardInfo: null, error: null }),
            }));
        }, setStatus: (status) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { status }),
            }));
        }, setViewMode: (mode) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { viewMode: mode }),
            }));
        }, setFlashcardInfo: (info) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { flashcardInfo: info, status: (info === null || info === void 0 ? void 0 : info.exists) ? "exists" : "none" }),
            }));
        }, setError: (error) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { error, status: error ? "none" : s.panel.status }),
            }));
        }, isCurrentFile: (file) => {
            const currentFile = get().panel.currentFile;
            if (!file || !currentFile) {
                return file === currentFile;
            }
            return currentFile.path === file.path;
        }, setUncollectedInfo: (count) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { uncollectedCount: count }),
            }));
        }, hasUncollectedFlashcards: () => {
            return get().panel.uncollectedCount > 0;
        }, setHasHighlights: (value) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { hasHighlights: value }),
            }));
        } }), (() => {
        const sel = createSelectionActions(set, get, "panel", "selectionMode", "selectedCardIds");
        return {
            enterSelectionMode: sel.enterSelectionMode,
            exitSelectionMode: sel.exitSelectionMode,
            toggleCardSelection: sel.toggleSelection,
            isInSelectionMode: sel.isInSelectionMode,
            selectAll: (cardIds) => {
                set((s) => ({
                    panel: Object.assign(Object.assign({}, s.panel), { selectionMode: "selecting", selectedCardIds: new Set(cardIds) }),
                }));
            },
        };
    })()), { toggleCardExpanded: toggleSetItem(set, get, "panel", "expandedCardIds"), setSearchQuery: (query) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { searchQuery: query }),
            }));
        }, setAddCardExpanded: (expanded) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { isAddCardExpanded: expanded }),
            }));
        }, setReviewFollowState: (sourcePath, isActive) => {
            set((s) => ({
                panel: Object.assign(Object.assign({}, s.panel), { isFollowingReview: isActive && sourcePath !== null, reviewSourceNotePath: isActive ? sourcePath : null }),
            }));
        } });
    return slice;
}
