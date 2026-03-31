import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { cn } from "@true-recall/obsidian/utils";
const BASE_TABS = [
    { id: "projects", label: "Projects" },
    { id: "notes", label: "Notes" },
];
const CHIP_ACTIVE = "ep:bg-obs-interactive/15 ep:text-obs-interactive";
const CHIP_INACTIVE = "ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal";
export function DashboardTabs({ activeTab, onTabChange, projectCount, notesCount, orphanedCount, showArchived, onToggleArchived, }) {
    const tabs = orphanedCount > 0
        ? [...BASE_TABS, { id: "orphaned", label: "Orphaned" }]
        : BASE_TABS;
    const counts = {
        projects: projectCount,
        notes: notesCount,
        orphaned: orphanedCount,
    };
    return (_jsx("div", { class: "ep:border-b ep:border-obs-border", children: _jsxs("div", { class: "ep:flex ep:items-center ep:gap-6", role: "tablist", children: [tabs.map(({ id, label }) => {
                    const isActive = activeTab === id;
                    const count = counts[id];
                    return (_jsxs(Clickable, { role: "tab", "aria-selected": isActive, class: cn("ep:relative ep:pb-2.5 ep:text-sm ep:transition-colors ep:duration-150", isActive
                            ? "ep:text-obs-normal ep:font-semibold"
                            : "ep:text-obs-muted ep:hover:text-obs-normal"), onClick: () => onTabChange(id), children: [label, count > 0 && (_jsx("span", { class: "ep:ml-1.5 ep:text-obs-faint ep:tabular-nums ep:font-normal", children: count })), isActive && (_jsx("div", { class: "ep:absolute ep:-bottom-px ep:left-0 ep:right-0 ep:h-[2px] ep:bg-obs-interactive ep:rounded-t" }))] }, id));
                }), _jsx(Clickable, { class: cn("ep:ml-auto ep:mb-1 ep:px-2 ep:py-0.5 ep:rounded-full ep:text-[10px] ep:font-medium ep:transition-colors ep:duration-150", showArchived ? CHIP_ACTIVE : CHIP_INACTIVE), onClick: onToggleArchived, "aria-label": "Toggle archived items", children: "Archived" })] }) }));
}
