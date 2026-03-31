import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { parseIODefinition } from "@true-recall/core/utils/io-definition";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { IOCardRenderer } from "@true-recall/obsidian/features/image-occlusion/IOCardRenderer";
import { useCardActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useCardActions";
import { useSelectionActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useSelectionActions";
import { useContextMenu, } from "@true-recall/obsidian/preact/useContextMenu";
import { useCallback, useMemo, useState } from "preact/hooks";
export function PanelIOGroup({ cards, fsrsCards, filePath: _filePath, isExpanded, isSelected, isSelectionMode, }) {
    var _a;
    const [revealedOrd, setRevealedOrd] = useState(null);
    const cardActions = useCardActions();
    const selectionActions = useSelectionActions();
    const firstCard = cards[0];
    const groupKey = (_a = firstCard === null || firstCard === void 0 ? void 0 : firstCard.id) !== null && _a !== void 0 ? _a : "";
    const representative = fsrsCards[0];
    const imagePath = representative === null || representative === void 0 ? void 0 : representative.ioImagePath;
    const regionsJson = representative === null || representative === void 0 ? void 0 : representative.ioRegionsJson;
    const regionLabels = useMemo(() => {
        var _a;
        if (!regionsJson)
            return [];
        const def = parseIODefinition(regionsJson);
        if (!def)
            return [];
        const labelMap = new Map();
        for (const [i, r] of def.regions.entries()) {
            const ord = Number.parseInt(r.groupKey, 10);
            const key = Number.isFinite(ord) && ord >= 0 ? ord : i;
            if (!labelMap.has(key)) {
                labelMap.set(key, (_a = r.label) !== null && _a !== void 0 ? _a : `Region ${key + 1}`);
            }
        }
        return [...labelMap.entries()].sort((a, b) => a[0] - b[0]);
    }, [regionsJson]);
    const handleClick = useCallback((e) => {
        if (e.target.closest("button"))
            return;
        if (isSelectionMode) {
            for (const c of cards)
                selectionActions.handleToggleSelect(c.id);
        }
        else {
            cardActions.handleToggleExpand(groupKey);
        }
    }, [isSelectionMode, selectionActions, cardActions, cards, groupKey]);
    const handleRegionClick = useCallback((ord) => {
        setRevealedOrd((prev) => (prev === ord ? null : ord));
    }, []);
    const handleCheckboxClick = useCallback((e) => {
        e.stopPropagation();
        for (const c of cards)
            selectionActions.handleToggleSelect(c.id);
    }, [selectionActions, cards]);
    const handleMenuClick = useContextMenu([
        {
            title: "Edit",
            icon: "pencil",
            onClick: () => firstCard && cardActions.handleEditButton(firstCard),
        },
        {
            title: "Move",
            icon: "folder-input",
            onClick: () => firstCard && cardActions.handleMoveCard(firstCard),
        },
        "separator",
        {
            title: "Delete all",
            icon: "trash-2",
            onClick: () => {
                for (const c of cards)
                    cardActions.handleDeleteCard(c);
            },
        },
        ...(!isSelectionMode
            ? [
                "separator",
                {
                    title: "Select",
                    icon: "check-square",
                    onClick: () => selectionActions.handleEnterSelectionMode(groupKey),
                },
            ]
            : []),
    ]);
    const selectedCls = isSelected ? "ep:border-obs-interactive" : "";
    return (_jsxs(Clickable, { class: `ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border-[1px] ep:border-obs-border/20 ep:shadow-sm ep:hover:bg-obs-modifier-hover ep:transition-colors ep:duration-300 ${selectedCls}`, onClick: handleClick, onContextMenu: isSelectionMode ? undefined : handleMenuClick, children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:p-3 ep:text-left ep:w-full", children: [isSelectionMode && (_jsx("input", { type: "checkbox", class: "ep:w-4 ep:h-4 ep:cursor-pointer", checked: isSelected, onClick: handleCheckboxClick })), _jsx("div", { class: "ep:flex-1 ep:overflow-hidden ep:rounded", children: _jsx(IOCardRenderer, { imagePath: imagePath, regionsJson: regionsJson, templateOrd: revealedOrd !== null && revealedOrd !== void 0 ? revealedOrd : -1, revealed: revealedOrd !== null, maskModeOverride: "all", revealSingleOnly: true, onRegionClick: handleRegionClick }) })] }), isExpanded && (_jsx("div", { class: "ep:px-3 ep:pb-3 ep:pt-2 ep:border-t ep:border-obs-border", children: _jsx("div", { class: "ep:flex ep:flex-wrap ep:gap-1.5", children: regionLabels.map(([ord, label]) => (_jsx(Clickable, { class: `ep:text-ui-smaller ep:px-2 ep:py-1 ep:rounded-md ep:border ep:transition-colors ${revealedOrd === ord
                            ? "ep:border-obs-green/50 ep:bg-obs-green/10 ep:text-obs-green"
                            : "ep:border-obs-border ep:text-obs-muted ep:hover:border-obs-accent/30"}`, onClick: () => handleRegionClick(ord), children: label }, ord))) }) }))] }));
}
