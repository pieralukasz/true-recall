import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { IconButton, SearchInput } from "@true-recall/obsidian/components";
import { useCardActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useCardActions";
import { usePanelActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelActions";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { countByState } from "@true-recall/obsidian/features/library/ui/panel/utils/card-status.utils";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { usePlugin } from "@true-recall/obsidian/preact";
import { Menu } from "obsidian";
import { useCallback } from "preact/hooks";
export function NormalHeader({ streamingNewCount, onRefresh, }) {
    var _a, _b, _c, _d, _e, _f;
    const plugin = usePlugin();
    const { flashcardInfo, cardsWithFsrs, searchQuery, isFollowingReview, uncollectedCount, hasHighlights, } = usePanelStore();
    const panelActions = usePanelActions();
    const cardActions = useCardActions();
    const reviewedToday = (_a = plugin.sessionPersistence) === null || _a === void 0 ? void 0 : _a.getReviewedToday();
    const dayStartHour = plugin.settings.dayStartHour;
    const hasUncollectedFlashcards = uncollectedCount > 0;
    const totalCount = ((_b = flashcardInfo === null || flashcardInfo === void 0 ? void 0 : flashcardInfo.flashcards.length) !== null && _b !== void 0 ? _b : 0) + streamingNewCount;
    const handleMoreMenu = useCallback((e) => {
        var _a;
        const menu = new Menu();
        const hasFlashcards = ((_a = flashcardInfo === null || flashcardInfo === void 0 ? void 0 : flashcardInfo.cardCount) !== null && _a !== void 0 ? _a : 0) > 0;
        menu.addItem((item) => item.setTitle("Refresh").setIcon("refresh-cw").onClick(onRefresh));
        menu.addItem((item) => item
            .setTitle("Open source note")
            .setIcon("file-text")
            .onClick(panelActions.handleOpenSourceNote));
        if (hasHighlights) {
            menu.addItem((item) => item
                .setTitle("Generate from highlights")
                .setIcon("highlighter")
                .onClick(panelActions.handleGenerateFromHighlights));
        }
        if (hasFlashcards) {
            menu.addItem((item) => item
                .setTitle("Browse in card browser")
                .setIcon("table-2")
                .onClick(panelActions.handleBrowseDeck));
            menu.addSeparator();
            menu.addItem((item) => item
                .setTitle("Copy to clipboard")
                .setIcon("clipboard-copy")
                .onClick(panelActions.handleCopyAllToClipboard));
            menu.addItem((item) => item
                .setTitle("Export as CSV")
                .setIcon("file-down")
                .onClick(panelActions.handleExportCsv));
            menu.addSeparator();
            menu.addItem((item) => item
                .setTitle("Forget all flashcards")
                .setIcon("rotate-ccw")
                .onClick(panelActions.handleForgetAll));
            menu.addItem((item) => item
                .setTitle("Delete all flashcards")
                .setIcon("trash-2")
                .onClick(panelActions.handleDeleteAll));
            menu.addItem((item) => item
                .setTitle("Delete note & all flashcards")
                .setIcon("file-x-2")
                .onClick(panelActions.handleDeleteNoteAndCards));
        }
        menu.showAtMouseEvent(e);
    }, [flashcardInfo, onRefresh, hasHighlights, panelActions]);
    const baseCounts = cardsWithFsrs.length > 0
        ? countByState(cardsWithFsrs, reviewedToday, dayStartHour)
        : null;
    const counts = baseCounts || streamingNewCount > 0
        ? {
            new: ((_c = baseCounts === null || baseCounts === void 0 ? void 0 : baseCounts.new) !== null && _c !== void 0 ? _c : 0) + streamingNewCount,
            learning: (_d = baseCounts === null || baseCounts === void 0 ? void 0 : baseCounts.learning) !== null && _d !== void 0 ? _d : 0,
            review: (_e = baseCounts === null || baseCounts === void 0 ? void 0 : baseCounts.review) !== null && _e !== void 0 ? _e : 0,
        }
        : null;
    const badgeCls = "ep:flex ep:items-center ep:justify-center ep:min-w-5 ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold";
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-3", children: [_jsx("div", { class: "ep:text-ui-small ep:font-semibold ep:text-obs-normal", children: "Cards" }), counts && (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-1", children: [_jsx("div", { class: `${badgeCls} ${FSRS_COLORS.new.badgeCls}`, children: counts.new }), _jsx("div", { class: `${badgeCls} ${FSRS_COLORS.learning.badgeCls}`, children: counts.learning }), _jsx("div", { class: `${badgeCls} ${FSRS_COLORS.review.badgeCls}`, children: counts.review })] }))] }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-1", children: [isFollowingReview && (_jsx(IconButton, { icon: "file-text", ariaLabel: "Open source note", onClick: panelActions.handleOpenSourceNote, size: "small" })), hasUncollectedFlashcards && (_jsx(IconButton, { icon: "download", ariaLabel: `Collect ${uncollectedCount} flashcards`, onClick: () => void panelActions.handleCollect(), size: "small", label: String(uncollectedCount), class: "true-recall-pulse-collect" })), !isFollowingReview && (_jsx(IconButton, { icon: "brain", ariaLabel: "Start review", onClick: () => void panelActions.handleReview(), size: "small", disabled: ((_f = flashcardInfo === null || flashcardInfo === void 0 ? void 0 : flashcardInfo.cardCount) !== null && _f !== void 0 ? _f : 0) === 0 })), _jsx(IconButton, { icon: "plus", ariaLabel: "Add flashcard", onClick: cardActions.handleAddFlashcard, size: "small" }), _jsx(IconButton, { icon: "more-vertical", ariaLabel: "More actions", onClick: handleMoreMenu, size: "small" })] })] }), _jsx(SearchInput, { value: searchQuery, placeholder: "Search flashcards...", ariaLabel: "Search flashcards", onChange: panelActions.handleSearchChange, disabled: totalCount === 0 })] }));
}
