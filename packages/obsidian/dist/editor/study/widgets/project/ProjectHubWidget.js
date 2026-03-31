import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { archivedSourceUids, cards, } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { computeProjectStats } from "../project-stats";
import { ProjectCard } from "./ProjectWidget";
export function ProjectHubWidget() {
    const plugin = usePlugin();
    const projects = useComputed(() => {
        void cards.value;
        const archived = archivedSourceUids.value;
        if (!plugin.cardStore)
            return [];
        const hierarchy = plugin.hierarchyService.buildHierarchy();
        const flat = [];
        const flatten = (nodes, depth) => {
            for (const node of nodes) {
                if (plugin.hierarchyService.isProjectArchived(node.path))
                    continue;
                const allSourceUids = plugin.hierarchyService.getSourceUidsForProject(node.path);
                const filteredUids = new Set([...allSourceUids].filter((uid) => !archived.has(uid)));
                const stats = computeProjectStats(node.path, node.name, node.children.length, plugin.hierarchyService, plugin.cardStore, plugin.fsrsService, { sourceUids: filteredUids });
                flat.push({ stats, depth });
                flatten(node.children, depth + 1);
            }
        };
        flatten(hierarchy, 0);
        return sortByUrgency(flat);
    }).value;
    if (projects.length === 0) {
        return (_jsxs("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: ["No projects found. Add ", _jsx("code", { children: "parents: [\"[[project note]]\"]" }), " to child notes to create a project hierarchy."] }));
    }
    return (_jsx("div", { class: "ep:grid ep:grid-cols-1 ep:gap-2 ep:p-1", children: projects.map(({ stats, depth }) => (_jsx(ProjectCard, { stats: stats, depth: depth, onClickName: () => {
                void plugin.app.workspace.openLinkText(stats.path, "", false);
            }, onReview: () => {
                plugin
                    .openReviewViewWithFilters({
                    projectPath: stats.path,
                    ignoreDailyLimits: true,
                })
                    .catch(() => { });
            }, onCustomStudy: () => {
                const members = plugin.hierarchyService.getChildPaths(stats.path);
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
            } }, stats.path))) }));
}
/**
 * Sort so root projects appear by urgency (due desc), but children
 * stay grouped under their parent. We do this by sorting only the
 * root-level blocks (a root + its descendants) by the root's due count.
 */
function sortByUrgency(flat) {
    var _a;
    const blocks = [];
    for (const item of flat) {
        if (item.depth === 0) {
            blocks.push([item]);
        }
        else {
            (_a = blocks[blocks.length - 1]) === null || _a === void 0 ? void 0 : _a.push(item);
        }
    }
    blocks.sort((a, b) => {
        var _a, _b, _c, _d;
        const aDue = (_b = (_a = a[0]) === null || _a === void 0 ? void 0 : _a.stats.due) !== null && _b !== void 0 ? _b : 0;
        const bDue = (_d = (_c = b[0]) === null || _c === void 0 ? void 0 : _c.stats.due) !== null && _d !== void 0 ? _d : 0;
        return bDue - aDue;
    });
    return blocks.flat();
}
