import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSignal } from "@preact/signals";
import { usePlugin } from "@true-recall/obsidian/preact";
import { TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import { getDragClass } from "../helpers/drag-drop";
import { UNASSIGNED_PATH } from "../helpers/project-aggregation";
import { collectMatchingPaths, flattenProjectTree, } from "../helpers/project-tree-flatten";
import { useProjectActions } from "../helpers/use-project-actions";
import { useProjectDragDrop } from "../helpers/use-project-drag-drop";
import { useExternalVirtualList } from "../helpers/use-virtual-list";
import { NoteRow } from "./NoteRow";
import { EmptyProjectRow, ProjectHeaderRow } from "./ProjectHeaderRow";
export function ProjectsTab({ projects, searchQuery, scrollContainerRef, scrollTop, onStudyNote, onPresetClick, }) {
    var _a, _b;
    const plugin = usePlugin();
    const expandedPaths = useSignal(new Set());
    const contentRef = useRef(null);
    const { handleArchive, handleRename } = useProjectActions();
    const { dragState, handleDragStart, handleDragEnd, handleDragOver, handleDrop, handleRootDrop, } = useProjectDragDrop();
    useEffect(() => {
        if (!searchQuery)
            return;
        expandedPaths.value = collectMatchingPaths(projects, searchQuery);
    }, [searchQuery, projects]);
    const flatItems = useMemo(() => flattenProjectTree(projects, expandedPaths.value, searchQuery), [projects, expandedPaths.value, searchQuery]);
    const { totalHeight, virtualItems } = useExternalVirtualList({
        items: flatItems,
        scrollContainerRef,
        scrollTop,
        contentOffsetRef: contentRef,
    });
    const toggleExpand = useCallback((path) => {
        const next = new Set(expandedPaths.value);
        if (next.has(path))
            next.delete(path);
        else
            next.add(path);
        expandedPaths.value = next;
    }, [expandedPaths]);
    // ── Render ───────────────────────────────────────────
    if (flatItems.length === 0) {
        return (_jsx("div", { class: "ep:text-sm ep:text-obs-muted ep:p-4 ep:text-center", children: projects.length === 0
                ? "No projects found. Organize notes in folders or add include: folder to a note's frontmatter."
                : "No matching projects." }));
    }
    return (_jsxs("div", { children: [((_a = dragState.value) === null || _a === void 0 ? void 0 : _a.item.parentPath) && (_jsx(RootDropZone, { position: "top", onDrop: handleRootDrop })), _jsx("div", { ref: contentRef, style: { height: `${totalHeight}px`, position: "relative" }, children: virtualItems.map(({ item, offsetTop }) => {
                    if (item.type === "project-header") {
                        return (_jsx(ProjectHeaderItem, { item: item, offsetTop: offsetTop, dragState: dragState, plugin: plugin, onPresetClick: onPresetClick, onToggleExpand: toggleExpand, onArchive: handleArchive, onRename: handleRename, onDragStart: handleDragStart, onDragEnd: handleDragEnd, onDragOver: handleDragOver, onDrop: handleDrop }, `p-${item.project.path}`));
                    }
                    if (item.type === "note") {
                        return (_jsx(NoteItem, { item: item, offsetTop: offsetTop, dragState: dragState, plugin: plugin, onStudyNote: onStudyNote, onPresetClick: onPresetClick, onArchive: handleArchive, onRename: handleRename, onDragStart: handleDragStart, onDragEnd: handleDragEnd, onDragOver: handleDragOver, onDrop: handleDrop }, `n-${item.note.name}`));
                    }
                    return (_jsx("div", { style: {
                            position: "absolute",
                            top: `${offsetTop}px`,
                            left: 0,
                            right: 0,
                            height: "36px",
                        }, children: _jsx(EmptyProjectRow, { depth: item.depth }) }, `e-${item.projectPath}`));
                }) }), ((_b = dragState.value) === null || _b === void 0 ? void 0 : _b.item.parentPath) && (_jsx(RootDropZone, { position: "bottom", onDrop: handleRootDrop }))] }));
}
function ProjectHeaderItem({ item, offsetTop, dragState, plugin, onPresetClick, onToggleExpand, onArchive, onRename, onDragStart, onDragEnd, onDragOver, onDrop, }) {
    const isVirtual = item.project.path === UNASSIGNED_PATH;
    const dragCls = getDragClass(dragState.value, item.project.path);
    return (_jsx("div", { role: "listitem", class: dragCls || undefined, draggable: !isVirtual, onDragStart: isVirtual ? undefined : (e) => onDragStart(e, item), onDragEnd: isVirtual ? undefined : onDragEnd, onDragOver: isVirtual ? undefined : (e) => onDragOver(e, item), onDrop: isVirtual ? undefined : (e) => onDrop(e, item), style: {
            position: "absolute",
            top: `${offsetTop}px`,
            left: 0,
            right: 0,
            height: "36px",
        }, children: _jsx(ProjectHeaderRow, { project: item.project, depth: item.depth, isExpanded: item.isExpanded, isVirtual: isVirtual, onToggle: () => onToggleExpand(item.project.path), onStudyProject: () => {
                if (isVirtual) {
                    void plugin.openCustomStudyModal({
                        sourceNoteFilters: item.project.memberNotes.map((m) => m.name),
                        scopeLabel: "Unassigned",
                    });
                }
                else {
                    void plugin.openReviewViewWithFilters({
                        projectPath: item.project.path,
                    });
                }
            }, onCustomStudy: () => {
                void plugin.openCustomStudyModal({
                    sourceNoteFilters: item.project.memberNotes.map((m) => m.name),
                    scopeLabel: item.project.name,
                });
            }, onNavigate: isVirtual
                ? undefined
                : () => {
                    void plugin.app.workspace.openLinkText(item.project.name, "");
                }, onPresetClick: isVirtual ? undefined : onPresetClick, onArchive: isVirtual ? undefined : () => onArchive(item.project.path, true), onUnarchive: isVirtual ? undefined : () => onArchive(item.project.path, false), onRename: isVirtual ? undefined : () => void onRename(item.project.path) }) }));
}
function NoteItem({ item, offsetTop, dragState, plugin, onStudyNote, onPresetClick, onArchive, onRename, onDragStart, onDragEnd, onDragOver, onDrop, }) {
    const dragCls = getDragClass(dragState.value, item.note.path);
    return (_jsx("div", { role: "listitem", class: dragCls || undefined, draggable: !!item.note.path, onDragStart: (e) => onDragStart(e, item), onDragEnd: onDragEnd, onDragOver: (e) => onDragOver(e, item), onDrop: (e) => onDrop(e, item), style: {
            position: "absolute",
            top: `${offsetTop}px`,
            left: 0,
            right: 0,
            height: "36px",
            paddingLeft: `${item.depth * 20}px`,
        }, children: _jsx(NoteRow, { note: item.note, onNavigate: () => void plugin.app.workspace.openLinkText(item.note.name, ""), onStudy: () => onStudyNote(item.note.name, item.projectPath), onCustomStudy: () => {
                void plugin.openCustomStudyModal({
                    sourceNoteFilters: [item.note.name],
                    scopeLabel: item.note.name,
                });
            }, onPresetClick: onPresetClick, onArchive: () => item.note.path ? onArchive(item.note.path, true) : undefined, onUnarchive: () => item.note.path ? onArchive(item.note.path, false) : undefined, onRename: () => item.note.path ? void onRename(item.note.path) : undefined, onDetach: item.projectPath !== UNASSIGNED_PATH
                ? () => {
                    var _a, _b;
                    if (!item.note.path)
                        return;
                    const file = plugin.app.vault.getAbstractFileByPath(item.note.path);
                    if (!(file instanceof TFile))
                        return;
                    const parentName = (_b = (_a = item.projectPath.split("/").pop()) === null || _a === void 0 ? void 0 : _a.replace(/\.md$/, "")) !== null && _b !== void 0 ? _b : "";
                    void plugin.flashcardManager
                        .getFrontmatterService()
                        .removeParent(file.path, parentName);
                }
                : undefined }) }));
}
function RootDropZone({ position, onDrop, }) {
    const spacing = position === "top" ? "ep:mb-1" : "ep:mt-1";
    return (_jsx("div", { role: "listitem", class: `ep:h-10 ep:mx-2 ${spacing} ep:border-2 ep:border-dashed ep:border-obs-border ep:rounded-lg ep:flex ep:items-center ep:justify-center ep:text-xs ep:text-obs-muted ep:transition-colors`, onDragOver: (e) => {
            e.preventDefault();
            if (e.dataTransfer)
                e.dataTransfer.dropEffect = "move";
            e.currentTarget.classList.add("ep-drop-root-zone");
        }, onDragLeave: (e) => {
            e.currentTarget.classList.remove("ep-drop-root-zone");
        }, onDrop: onDrop, children: "Move to root level" }));
}
