import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
import { IconToolButton } from "./IOIconToolButton";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
function RegionListItem({ region, selected, onSelect, onDelete, }) {
    return (_jsxs("div", { class: `true-recall-io-region-item ${selected ? "is-selected" : ""}`, children: [_jsxs(Clickable, { class: "true-recall-io-region-main", onClick: () => onSelect(), title: `Select region #${region.groupKey}`, children: [_jsxs("span", { children: ["#", region.groupKey] }), _jsx("span", { children: region.shape })] }), selected && (_jsx(IconToolButton, { icon: "trash-2", label: `Delete region #${region.groupKey}`, shortcut: "Delete", danger: true, onClick: onDelete }))] }));
}
export function IORegionList({ regions, selectedRegionId, onSelectRegion, onDeleteSelected, }) {
    return (_jsxs("div", { class: "true-recall-io-side-section", children: [_jsxs("div", { class: "ep:text-ui-small ep:font-medium ep:mb-1", children: ["Regions (", regions.length, ")"] }), _jsxs("div", { class: "true-recall-io-region-list", children: [regions.length === 0 && (_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: "No regions yet" })), regions.map((region) => (_jsx(RegionListItem, { region: region, selected: selectedRegionId === region.id, onSelect: () => onSelectRegion(region.id), onDelete: onDeleteSelected }, region.id)))] })] }));
}
