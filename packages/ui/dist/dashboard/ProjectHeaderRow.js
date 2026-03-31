import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { CardCountDisplay } from "../shared/CardCountDisplay";
import { Clickable } from "../shared/Clickable";
import { IconButton } from "../shared/IconButton";
import { cn } from "../utils/cn";
import { computePriority, PRIORITY_DOT } from "./helpers";
export function ProjectHeaderRow({ project, depth, isExpanded: _isExpanded, isVirtual, onToggle, onStudyProject, onContextMenu, }) {
    const priority = computePriority({
        overdueCount: 0,
        due: project.due,
        learning: project.learning,
        newCount: project.newCount,
    });
    return (_jsxs(Clickable, { class: cn("ep:flex ep:items-center ep:gap-2 ep:px-3 ep:h-9 ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover", project.archived && "ep:opacity-50"), style: { paddingLeft: `${12 + depth * 20}px` }, onContextMenu: onContextMenu, onClick: onToggle, stopPropagation: false, children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:flex-1 ep:min-w-0", children: [_jsx("span", { class: cn("ep:inline-block ep:w-1.5 ep:h-1.5 ep:rounded-full ep:shrink-0", PRIORITY_DOT[priority]) }), _jsx("span", { class: cn("ep:text-sm ep:truncate ep:min-w-0 ep:font-medium", isVirtual ? "ep:text-obs-muted ep:italic" : "ep:text-obs-normal", project.archived && "ep:line-through"), children: project.name }), project.presetName && (_jsx("span", { class: "ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:shrink-0", title: `FSRS preset: ${project.presetName}`, children: project.presetName })), _jsxs("span", { class: "ep:text-xs ep:text-obs-muted ep:shrink-0 ep:tabular-nums", children: [project.totalMembers, project.totalMembers === 1 ? " note" : " notes", project.healthPct > 0 && ` \u00B7 ${project.healthPct}%`] })] }), _jsx(CardCountDisplay, { newCount: project.newCount, learningCount: project.learning, dueCount: project.due }), _jsx(IconButton, { icon: "play", ariaLabel: `Study ${project.name}`, onClick: onStudyProject, size: "small" })] }));
}
export function EmptyProjectRow({ depth }) {
    return (_jsx("div", { class: "ep:text-xs ep:text-obs-muted ep:px-3 ep:flex ep:items-center ep:h-9", style: { paddingLeft: `${12 + (depth + 1) * 20}px` }, children: "No member notes" }));
}
