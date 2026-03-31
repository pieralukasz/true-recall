import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { Notice } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { NoteTypeEditor } from "./NoteTypeEditor";
import { NoteTypeList } from "./NoteTypeList";
import { createDefaultDraft } from "./types";
export function NoteTypeManagerApp({ onClose: _onClose, }) {
    const plugin = usePlugin();
    const noteTypeService = plugin.noteTypeService;
    const [version, setVersion] = useState(0);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);
    const noteTypes = useMemo(() => noteTypeService.getAll(), 
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version signal triggers re-fetch when note types change
    [noteTypeService, version]);
    // Auto-select first type on mount
    useEffect(() => {
        var _a, _b;
        if (noteTypes.length > 0 && selectedId === null && draft === null) {
            setSelectedId((_b = (_a = noteTypes[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null);
        }
    }, [noteTypes, selectedId, draft]);
    const selected = useMemo(() => {
        var _a;
        return selectedId
            ? ((_a = noteTypes.find((nt) => nt.id === selectedId)) !== null && _a !== void 0 ? _a : null)
            : null;
    }, [noteTypes, selectedId]);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);
    const handleSelect = useCallback((id) => {
        setDraft(null);
        setSelectedId(id);
    }, []);
    const handleStartCreate = useCallback(() => {
        setDraft(createDefaultDraft());
        setSelectedId(null);
    }, []);
    const handleCreateSave = useCallback(() => {
        if (!draft)
            return;
        try {
            const created = noteTypeService.create({
                name: draft.name,
                fields: draft.fields,
                templates: draft.templates,
                css: draft.css,
            });
            setDraft(null);
            setSelectedId(created.id);
            refresh();
        }
        catch (e) {
            new Notice(e.message);
        }
    }, [draft, noteTypeService, refresh]);
    const handleCreateCancel = useCallback(() => {
        var _a, _b;
        setDraft(null);
        if (noteTypes.length > 0) {
            setSelectedId((_b = (_a = noteTypes[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null);
        }
    }, [noteTypes]);
    const handleDelete = useCallback((id) => {
        try {
            noteTypeService.delete(id);
            setSelectedId(null);
            refresh();
        }
        catch (e) {
            new Notice(e.message);
        }
    }, [noteTypeService, refresh]);
    return (_jsxs("div", { class: "ep:flex ep:h-[65vh]", children: [_jsx(NoteTypeList, { noteTypes: noteTypes, selectedId: draft ? null : selectedId, isCreating: draft !== null, onSelect: handleSelect, onCreate: handleStartCreate }), _jsx("div", { class: "ep:flex-1 ep:overflow-y-auto ep:pl-4", children: draft ? (_jsx(NoteTypeEditor, { mode: "create", draft: draft, onDraftChange: setDraft, onSave: handleCreateSave, onCancel: handleCreateCancel })) : selected ? (_jsx(NoteTypeEditor, { mode: selected.isBuiltin ? "view" : "edit", noteType: selected, noteTypeService: noteTypeService, onRefresh: refresh, onDelete: handleDelete })) : (_jsx("div", { class: "ep:flex ep:items-center ep:justify-center ep:h-full ep:text-obs-muted", children: "Select a note type" })) })] }));
}
