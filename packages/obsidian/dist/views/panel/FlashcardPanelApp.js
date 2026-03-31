import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Panel } from "@true-recall/obsidian/components";
import { NormalHeader, PanelContent, SelectionToolbar, } from "@true-recall/obsidian/features/library/ui/panel/components";
import { PanelScrollProvider, usePanelStore, useScrollPreservation, } from "@true-recall/obsidian/features/library/ui/panel/hooks";
import { useStreamingNewCount } from "@true-recall/obsidian/features/library/ui/panel/hooks/useStreamingNewCount";
import { Platform } from "obsidian";
import { useMemo } from "preact/hooks";
export function FlashcardPanelApp({ onActions, }) {
    var _a;
    const store = usePanelStore();
    const { contentRef, preserveScroll, captureScroll } = useScrollPreservation();
    const scrollApi = useMemo(() => ({ preserveScroll, captureScroll }), [preserveScroll, captureScroll]);
    const streamingNewCount = useStreamingNewCount(store.cardsWithFsrs, (_a = store.currentFile) === null || _a === void 0 ? void 0 : _a.path);
    const showHeader = !Platform.isMobile;
    return (_jsx(PanelScrollProvider, { value: scrollApi, children: _jsx(Panel, { disableScroll: true, children: _jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:h-full", children: [showHeader && (_jsx("div", { class: "ep:shrink-0", children: store.selectionMode === "selecting" ? (_jsx(SelectionToolbar, {})) : (_jsx(NormalHeader, { streamingNewCount: streamingNewCount, onRefresh: () => onActions === null || onActions === void 0 ? void 0 : onActions({ type: "refresh" }) })) })), _jsx("div", { ref: contentRef, class: "ep:flex-1 ep:overflow-y-auto ep:min-h-0", children: _jsx(PanelContent, {}) }), store.currentFile && (_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-faint ep:truncate ep:text-center ep:px-2 ep:shrink-0", title: store.currentFile.basename, children: store.currentFile.basename }))] }) }) }));
}
