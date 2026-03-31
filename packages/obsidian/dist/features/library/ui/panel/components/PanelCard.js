import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { MarkdownContent } from "@true-recall/obsidian/components/MarkdownContent";
import { useCardActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useCardActions";
import { usePanelActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelActions";
import { useSelectionActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useSelectionActions";
import { getHighlightColor, getStatusTitle, isBuried, isSuspended, } from "@true-recall/obsidian/features/library/ui/panel/utils/card-status.utils";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { useContextMenu, } from "@true-recall/obsidian/preact/useContextMenu";
import { useLongPress } from "@true-recall/obsidian/preact/useLongPress";
import { cn } from "@true-recall/obsidian/utils";
import { cva } from "class-variance-authority";
import { useCallback } from "preact/hooks";
// ── Variants ────────────────────────────────────────────────
const panelCardVariants = cva("ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-surface-raised ep:border-[1px] ep:border-obs-border/20 ep:shadow-raised ep:hover:bg-obs-modifier-hover ep:transition-colors ep:duration-300", {
    variants: {
        state: {
            green: "ep:hover:border-obs-green/30",
            orange: "ep:hover:border-obs-orange/30",
            blue: "ep:hover:border-obs-blue/30",
            red: "ep:hover:border-obs-red/30",
            default: "ep:hover:border-obs-border",
        },
    },
    defaultVariants: { state: "default" },
});
// ── Sub-components ──────────────────────────────────────────
function CardStatusBadge({ fsrsCard }) {
    var _a;
    if (isSuspended(fsrsCard)) {
        return (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-red ep:font-medium ep:shrink-0", title: "Suspended - excluded from review", children: "S" }));
    }
    if (isBuried(fsrsCard)) {
        return (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-faint ep:font-medium ep:shrink-0", title: `Buried until ${new Date((_a = fsrsCard === null || fsrsCard === void 0 ? void 0 : fsrsCard.fsrs.buriedUntil) !== null && _a !== void 0 ? _a : "").toLocaleDateString()}`, children: "B" }));
    }
    return null;
}
function CardTypeBadge({ card }) {
    if (card.cardType === "cloze" && card.clozeIndex != null) {
        return (_jsxs("span", { class: "ep:text-xs ep:text-obs-muted ep:bg-obs-base-25 ep:rounded-full ep:px-1.5 ep:py-0.5 ep:shrink-0 ep:leading-none", title: "Cloze deletion", children: ["C", card.clozeIndex] }));
    }
    if (card.cardType === "reversed") {
        return (_jsx("span", { class: "ep:text-xs ep:text-obs-muted ep:bg-obs-base-25 ep:rounded-full ep:px-1.5 ep:py-0.5 ep:shrink-0 ep:leading-none", title: "Reversed card", children: "\u21C4" }));
    }
    return null;
}
// ── Main component ─────────────────────────────────────────
export function PanelCard({ card, fsrsCard, filePath, isExpanded, isSelected, isSelectionMode, enterClass, enterStyle, }) {
    var _a;
    const app = useApp();
    const cardActions = useCardActions();
    const selectionActions = useSelectionActions();
    const panelActions = usePanelActions();
    const { handlers: longPressHandlers, wasLongPress } = useLongPress({
        onLongPress: () => selectionActions.handleEnterSelectionMode(card.id),
    });
    const handleLinkClick = useCallback((href) => void app.workspace.openLinkText(href, filePath, false), [app, filePath]);
    const handleRowClick = useCallback((e) => {
        if (wasLongPress())
            return;
        if (e.target.closest("button"))
            return;
        if (e.target.closest("a"))
            return;
        if (isSelectionMode) {
            selectionActions.handleToggleSelect(card.id);
        }
        else if (card.sourceText) {
            cardActions.handleToggleExpand(card.id);
            panelActions.handleJumpToSource(card);
        }
        else {
            cardActions.handleToggleExpand(card.id);
        }
    }, [
        isSelectionMode,
        selectionActions,
        cardActions,
        panelActions,
        card,
        wasLongPress,
    ]);
    const handleMenuClick = useContextMenu([
        {
            title: "Edit",
            icon: "pencil",
            onClick: () => cardActions.handleEditButton(card),
        },
        {
            title: "Copy",
            icon: "copy",
            onClick: () => cardActions.handleCopyCard(card),
        },
        {
            title: "Move",
            icon: "folder-input",
            onClick: () => cardActions.handleMoveCard(card),
        },
        {
            title: "Change type",
            icon: "replace",
            onClick: () => cardActions.handleChangeType(card),
        },
        ...(card.cardType !== "cloze" && card.cardType !== "image-occlusion"
            ? [
                {
                    title: card.cardType === "reversed"
                        ? "Remove reversed"
                        : "Make reversed",
                    icon: "arrow-left-right",
                    onClick: () => cardActions.handleToggleReversed(card),
                },
            ]
            : []),
        {
            title: "Forget",
            icon: "rotate-ccw",
            onClick: () => cardActions.handleForgetCard(card),
        },
        isSuspended(fsrsCard)
            ? {
                title: "Unsuspend",
                icon: "play",
                onClick: () => cardActions.handleUnsuspendCard(card),
            }
            : {
                title: "Suspend",
                icon: "pause",
                onClick: () => cardActions.handleSuspendCard(card),
            },
        "separator",
        {
            title: "Delete",
            icon: "trash-2",
            onClick: () => cardActions.handleDeleteCard(card),
        },
        ...(!isSelectionMode
            ? [
                "separator",
                {
                    title: "Select",
                    icon: "check-square",
                    onClick: () => selectionActions.handleEnterSelectionMode(card.id),
                },
            ]
            : []),
    ]);
    const handleCheckboxClick = useCallback((e) => {
        e.stopPropagation();
        selectionActions.handleToggleSelect(card.id);
    }, [selectionActions, card.id]);
    const title = getStatusTitle(fsrsCard);
    const state = getHighlightColor(fsrsCard);
    const selectedCls = isSelected ? "ep:border-obs-interactive" : "";
    const onHoverSource = card.sourceText
        ? () => panelActions.handleHoverSource(card)
        : undefined;
    const onLeaveSource = card.sourceText
        ? panelActions.handleLeaveSource
        : undefined;
    return (_jsxs(Clickable, Object.assign({ title: title, class: cn(panelCardVariants({ state: isSelected ? undefined : state }), selectedCls, enterClass), style: enterStyle, onClick: handleRowClick, onContextMenu: isSelectionMode ? undefined : handleMenuClick }, longPressHandlers, { onMouseEnter: onHoverSource, onMouseLeave: onLeaveSource, children: [_jsxs("div", { class: "ep:flex ep:items-start ep:gap-2 ep:p-3 ep:text-left ep:w-full", children: [isSelectionMode && (_jsx("input", { type: "checkbox", class: "ep:w-4 ep:h-4 ep:cursor-pointer", checked: isSelected, onClick: handleCheckboxClick })), _jsx(CardStatusBadge, { fsrsCard: fsrsCard }), _jsx(CardTypeBadge, { card: card }), _jsx(MarkdownContent, { markdown: card.question, filePath: filePath, class: "ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown", onLinkClick: handleLinkClick })] }), isExpanded && (_jsxs("div", { class: "ep:px-3 ep:pb-3 ep:pt-2 ep:border-t ep:border-obs-border", children: [!card.answer && (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted", children: "No answer" })), _jsx(MarkdownContent, { markdown: (_a = card.answer) !== null && _a !== void 0 ? _a : "empty", filePath: filePath, class: "ep:text-ui-small ep:text-obs-normal true-recall-panel-card-field", onLinkClick: handleLinkClick }), fsrsCard && fsrsCard.fsrs.reps > 0 && (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-3 ep:mt-2 ep:pt-2 ep:border-t ep:border-obs-border/50", children: [_jsxs("span", { class: "ep:text-ui-smaller ep:text-obs-faint", children: [fsrsCard.fsrs.reps, " reviews"] }), fsrsCard.fsrs.stability > 0 && (_jsxs("span", { class: "ep:text-ui-smaller ep:text-obs-faint", children: ["S: ", fsrsCard.fsrs.stability.toFixed(1), "d"] })), fsrsCard.fsrs.lapses > 0 && (_jsxs("span", { class: "ep:text-ui-smaller ep:text-obs-faint", children: [fsrsCard.fsrs.lapses, " lapses"] })), fsrsCard.noteTypeName && (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-faint", children: fsrsCard.noteTypeName }))] }))] }))] })));
}
