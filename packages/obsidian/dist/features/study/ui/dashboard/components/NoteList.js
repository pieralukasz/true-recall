import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { usePlugin } from "@true-recall/obsidian/preact";
import { TFile } from "obsidian";
import { useRef } from "preact/hooks";
import { getDragClass } from "../helpers/drag-drop";
import { useNoteBulkActions } from "../helpers/use-note-bulk-actions";
import { useNoteDragDrop } from "../helpers/use-note-drag-drop";
import { useNoteFiltering } from "../helpers/use-note-filtering";
import { useNoteSelection } from "../helpers/use-note-selection";
import { useExternalVirtualList } from "../helpers/use-virtual-list";
import { NoteFilters } from "./NoteFilters";
import { NoteRow } from "./NoteRow";
import { SelectionBar } from "./SelectionBar";
export function NoteList({ notes, searchQuery, scrollContainerRef, scrollTop, onPresetClick, }) {
    const plugin = usePlugin();
    const contentRef = useRef(null);
    const { activeFilter, projectFilter, filteredNotes, counts, unassignedCount, handleFilterChange, handleProjectFilterChange, } = useNoteFiltering({ notes, searchQuery });
    const { selectedPaths, selectedCount, isSelecting, exitSelection, toggleSelect, enterSelection, selectAll, } = useNoteSelection({ filteredNotes });
    const { handleCreateProjectFromSelected, handleArchiveSelected, handleStudySelected, } = useNoteBulkActions({ selectedPaths, filteredNotes, exitSelection });
    const { dragState, handleDragStart, handleDragEnd, handleDragOver, handleDrop, } = useNoteDragDrop();
    const { totalHeight, virtualItems } = useExternalVirtualList({
        items: filteredNotes,
        scrollContainerRef,
        scrollTop,
        contentOffsetRef: contentRef,
    });
    // ── Note handlers ───────────────────────────────────
    const handleNavigateToNote = (note) => {
        void plugin.app.workspace.openLinkText(note.name, "");
    };
    const handleStudyNote = (noteName) => {
        void plugin.openReviewViewWithFilters({
            sourceNoteFilter: noteName,
            ignoreDailyLimits: plugin.settings.ignoreDailyLimitsForNoteStudy,
        });
    };
    const handleCustomStudy = (note) => {
        void plugin.openCustomStudyModal({
            sourceNoteFilters: [note.name],
            scopeLabel: note.name,
        });
    };
    const handleProjectClick = (projectName) => {
        projectFilter.value = { type: "project", name: projectName };
    };
    const handleArchiveNote = (note) => {
        if (!note.path)
            return;
        const file = plugin.app.vault.getAbstractFileByPath(note.path);
        if (file instanceof TFile) {
            void plugin.flashcardManager
                .getFrontmatterService()
                .setArchive(file.path, true);
        }
    };
    const handleUnarchiveNote = (note) => {
        if (!note.path)
            return;
        const file = plugin.app.vault.getAbstractFileByPath(note.path);
        if (file instanceof TFile) {
            void plugin.flashcardManager
                .getFrontmatterService()
                .setArchive(file.path, false);
        }
    };
    // ── Render ──────────────────────────────────────────
    return (_jsxs("div", { class: "ep:flex ep:flex-col", children: [_jsx("div", { class: "ep:shrink-0 ep:mb-3", children: _jsx(NoteFilters, { activeFilter: activeFilter.value, onFilterChange: handleFilterChange, counts: counts, projectFilter: projectFilter.value, unassignedCount: unassignedCount, onProjectFilterChange: handleProjectFilterChange }) }), isSelecting && (_jsx(SelectionBar, { selectedCount: selectedCount, onSelectAll: selectAll, onCreateProject: () => void handleCreateProjectFromSelected(), onArchive: () => void handleArchiveSelected(), onStudy: handleStudySelected, onCancel: exitSelection })), filteredNotes.length === 0 ? (_jsx("div", { class: "ep:text-sm ep:text-obs-muted ep:p-4 ep:text-center", children: notes.length === 0
                    ? "No notes with flashcards yet."
                    : "No matching notes." })) : (_jsx("div", { ref: contentRef, style: {
                    height: `${totalHeight}px`,
                    position: "relative",
                }, children: virtualItems.map(({ item, offsetTop }) => {
                    const dragCls = getDragClass(dragState.value, item.path);
                    return (_jsx("div", { role: "listitem", class: dragCls || undefined, draggable: !isSelecting && !!item.path, onDragStart: (e) => handleDragStart(e, item), onDragEnd: handleDragEnd, onDragOver: (e) => handleDragOver(e, item), onDrop: (e) => handleDrop(e, item), style: {
                            position: "absolute",
                            top: `${offsetTop}px`,
                            left: 0,
                            right: 0,
                            height: "36px",
                        }, children: _jsx(NoteRow, { note: item, onNavigate: () => handleNavigateToNote(item), onStudy: () => handleStudyNote(item.name), onCustomStudy: () => handleCustomStudy(item), onProjectClick: handleProjectClick, onPresetClick: onPresetClick, onArchive: () => handleArchiveNote(item), onUnarchive: () => handleUnarchiveNote(item), isSelectionMode: isSelecting, isSelected: item.path ? selectedPaths.value.has(item.path) : false, onToggleSelect: item.path
                                ? () => {
                                    const p = item.path;
                                    if (p)
                                        toggleSelect(p);
                                }
                                : undefined, onEnterSelection: item.path
                                ? () => {
                                    const p = item.path;
                                    if (p)
                                        enterSelection(p);
                                }
                                : undefined }) }, item.name));
                }) }))] }));
}
