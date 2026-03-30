import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { cn } from "@true-recall/obsidian/utils";
const CHIP_BASE = "ep:px-2.5 ep:py-1 ep:rounded-full ep:text-ui-smaller ep:font-medium ep:transition-colors ep:duration-150";
const CHIP_ACTIVE = "ep:bg-obs-interactive/15 ep:text-obs-interactive";
const CHIP_INACTIVE = "ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal";
const FILTERS = [
    { mode: "all", label: "All" },
    { mode: "due", label: "Due" },
    { mode: "new", label: "New" },
    { mode: "learning", label: "Learn" },
    { mode: "overdue", label: "Overdue" },
];
export function NoteFilters({ activeFilter, onFilterChange, counts, projectFilter, unassignedCount, onProjectFilterChange, }) {
    return (_jsxs("div", { class: "ep:flex ep:flex-wrap ep:items-center ep:gap-1.5", role: "tablist", children: [FILTERS.map(({ mode, label }) => {
                const isActive = activeFilter === mode;
                const count = counts[mode];
                return (_jsxs(Clickable, { role: "tab", "aria-selected": isActive, class: cn(CHIP_BASE, isActive ? CHIP_ACTIVE : CHIP_INACTIVE), onClick: () => onFilterChange(mode), children: [label, count > 0 && mode !== "all" && (_jsx("span", { class: cn("ep:ml-1 ep:tabular-nums", isActive ? "ep:text-obs-interactive/70" : "ep:text-obs-faint"), children: count }))] }, mode));
            }), _jsx("div", { class: "ep:w-px ep:h-4 ep:bg-obs-border ep:self-center ep:mx-0.5" }), _jsxs(Clickable, { class: cn(CHIP_BASE, projectFilter.type === "unassigned" ? CHIP_ACTIVE : CHIP_INACTIVE), onClick: () => {
                    onProjectFilterChange(projectFilter.type === "unassigned"
                        ? { type: "none" }
                        : { type: "unassigned" });
                }, children: ["Unassigned", unassignedCount > 0 && (_jsx("span", { class: cn("ep:ml-1 ep:tabular-nums", projectFilter.type === "unassigned"
                            ? "ep:text-obs-interactive/70"
                            : "ep:text-obs-faint"), children: unassignedCount }))] }), projectFilter.type === "project" && (_jsxs("div", { class: "ep:inline-flex ep:items-center ep:gap-1 ep:px-2.5 ep:py-1 ep:rounded-full ep:bg-obs-interactive/15 ep:text-obs-interactive ep:text-ui-smaller ep:font-medium", children: [projectFilter.name, _jsx(Clickable, { class: "ep:text-obs-interactive/50 ep:hover:text-obs-interactive ep:text-[10px] ep:leading-none", onClick: () => onProjectFilterChange({ type: "none" }), "aria-label": "Clear project filter", children: "\u2715" })] }))] }));
}
