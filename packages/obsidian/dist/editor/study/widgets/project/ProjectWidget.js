import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { archivedSourceUids, cards, } from "@true-recall/obsidian/services/reactive-card-store";
import { Clickable } from "@true-recall/obsidian/components";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { usePlugin } from "@true-recall/obsidian/preact";
import { computeProjectStats, healthColor, } from "../project-stats";
import { WidgetCta } from "../WidgetCta";
export function ProjectWidget({ sourcePath, }) {
    const plugin = usePlugin();
    // A note is a "project" if any note declares it as a parent
    const isProject = useComputed(() => {
        void cards.value;
        void archivedSourceUids.value;
        const children = plugin.hierarchyService.getChildPaths(sourcePath);
        return children.length > 0;
    }).value;
    const stats = useComputed(() => {
        var _a, _b;
        void cards.value;
        const archived = archivedSourceUids.value;
        if (!isProject || !plugin.cardStore)
            return null;
        const file = plugin.app.vault.getAbstractFileByPath(sourcePath);
        const name = (_b = (_a = file === null || file === void 0 ? void 0 : file.name) === null || _a === void 0 ? void 0 : _a.replace(/\.md$/, "")) !== null && _b !== void 0 ? _b : sourcePath;
        // Count sub-projects (children that themselves have children)
        const childPaths = plugin.hierarchyService.getChildPaths(sourcePath);
        const childCount = childPaths.filter((cp) => plugin.hierarchyService.getChildPaths(cp).length > 0).length;
        const allSourceUids = plugin.hierarchyService.getSourceUidsForProject(sourcePath);
        const filteredUids = new Set([...allSourceUids].filter((uid) => !archived.has(uid)));
        return computeProjectStats(sourcePath, name, childCount, plugin.hierarchyService, plugin.cardStore, plugin.fsrsService, { sourceUids: filteredUids });
    }).value;
    if (!isProject) {
        return (_jsxs("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: ["No child notes found. Add ", _jsx("code", { children: "parents: [\"[[this note]]\"]" }), " to other notes to use this as a project."] }));
    }
    if (!stats) {
        return _jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "Loading..." });
    }
    return (_jsx(ProjectCard, { stats: stats, onReview: () => {
            plugin
                .openReviewViewWithFilters({
                projectPath: sourcePath,
                ignoreDailyLimits: true,
            })
                .catch(() => { });
        }, onCustomStudy: () => {
            const members = plugin.hierarchyService.getChildPaths(sourcePath);
            const names = members.map((p) => {
                var _a, _b;
                const f = plugin.app.vault.getAbstractFileByPath(p);
                return (_b = (_a = f === null || f === void 0 ? void 0 : f.name) === null || _a === void 0 ? void 0 : _a.replace(/\.md$/, "")) !== null && _b !== void 0 ? _b : p;
            });
            plugin
                .openCustomStudyModal({
                sourceNoteFilters: names,
                scopeLabel: stats.name,
            })
                .catch(() => { });
        } }));
}
export function ProjectCard({ stats, onReview, onCustomStudy, onClickName, depth = 0, }) {
    const activeDue = stats.due + stats.newCount + stats.learning;
    return (_jsxs("div", { class: "ep:rounded-lg ep:border ep:border-obs-modifier-border ep:p-3 ep:flex ep:flex-col ep:gap-2", style: depth > 0 ? { marginLeft: `${depth * 12}px` } : undefined, children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:gap-2", children: [onClickName ? (_jsx(Clickable, { class: "ep:text-sm ep:font-semibold ep:text-obs-normal ep:hover:underline", onClick: onClickName, children: stats.name })) : (_jsx("span", { class: "ep:text-sm ep:font-semibold", children: stats.name })), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-1.5 ep:text-xs ep:shrink-0", children: [_jsxs("span", { class: "ep:text-obs-muted", children: [stats.healthPct, "%"] }), _jsx("div", { class: "ep:w-16 ep:h-2 ep:rounded-full ep:bg-obs-modifier-hover ep:overflow-hidden", children: _jsx("div", { class: "ep:h-full ep:rounded-full ep:transition-all", style: {
                                        width: `${stats.healthPct}%`,
                                        backgroundColor: healthColor(stats.healthPct),
                                    } }) })] })] }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs ep:flex-wrap", children: [_jsxs("span", { style: { color: `var(${FSRS_COLORS.new.cssVar})` }, children: [stats.newCount, " new"] }), _jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { style: { color: `var(${FSRS_COLORS.learning.cssVar})` }, children: [stats.learning, " learning"] }), _jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { style: { color: `var(${FSRS_COLORS.review.cssVar})` }, children: [stats.due, " due"] })] }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs ep:text-obs-muted ep:flex-wrap", children: [_jsxs("span", { children: [stats.totalCards, " cards"] }), stats.childCount > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { children: [stats.childCount, " sub-projects"] })] })), stats.lastReviewed && (_jsxs(_Fragment, { children: [_jsx("span", { style: { opacity: 0.4 }, children: "\u00B7" }), _jsxs("span", { children: ["Last: ", formatTimeAgo(stats.lastReviewed)] })] }))] }), activeDue > 0 && (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:pt-1", children: [_jsx(WidgetCta, { label: "Review \u2192", onClick: onReview }), _jsx(WidgetCta, { label: "Custom study \u2192", onClick: onCustomStudy, variant: "secondary" })] }))] }));
}
function formatTimeAgo(isoDate) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
