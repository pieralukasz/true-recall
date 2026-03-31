import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { CardTypesEditorModal } from "@true-recall/obsidian/modals/core/card-types-editor/CardTypesEditorModal";
import { NoteTypeManagerModal } from "@true-recall/obsidian/modals/core/NoteTypeManagerModal";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { FormattingToolbar, } from "@true-recall/obsidian/editor/shared/formatting";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { useApp, usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { Notice, TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useRef, useState, } from "preact/hooks";
import { ActionBar } from "./ActionBar";
import { NoteFieldsForm } from "./NoteFieldsForm";
export function QuickNoteEditorApp({ mode, onDone, onRequestClose, onContentChange, }) {
    const app = useApp();
    const plugin = usePlugin();
    const isEdit = mode.mode === "edit";
    const editMode = isEdit ? mode : null;
    const addMode = !isEdit ? mode : null;
    // ── State ──
    const [noteTypeId, setNoteTypeId] = useState(() => {
        var _a;
        if (isEdit && (editMode === null || editMode === void 0 ? void 0 : editMode.noteType.id)) {
            return editMode.noteType.id;
        }
        return (_a = addMode === null || addMode === void 0 ? void 0 : addMode.defaultNoteTypeId) !== null && _a !== void 0 ? _a : "builtin-basic";
    });
    const [fields, setFields] = useState(() => {
        if (isEdit)
            return Object.assign({}, editMode === null || editMode === void 0 ? void 0 : editMode.note.fields);
        if (addMode === null || addMode === void 0 ? void 0 : addMode.initialFields)
            return Object.assign({}, addMode.initialFields);
        return {};
    });
    const [saving, setSaving] = useState(false);
    const [pinnedFields, setPinnedFields] = useState(new Set());
    const [refreshCounter, setRefreshCounter] = useState(0);
    const [alwaysTypeIn, setAlwaysTypeIn] = useState(false);
    // Focus tracking for shared formatting toolbar
    const focusedFieldRef = useRef(null);
    const handleFieldFocus = useCallback((fieldName, editorView) => {
        focusedFieldRef.current = { fieldName, editorView };
    }, []);
    // Source note picker — only shown in add mode without pre-set sourceUid
    const showSourcePicker = !isEdit && !(addMode === null || addMode === void 0 ? void 0 : addMode.sourceUid);
    const [selectedSourceNote, setSelectedSourceNote] = useState(null);
    // ── Derived ──
    const noteType = useMemo(() => {
        var _a, _b, _c;
        if (isEdit)
            return editMode === null || editMode === void 0 ? void 0 : editMode.noteType;
        return (_c = (_b = (_a = plugin.cardStore) === null || _a === void 0 ? void 0 : _a.noteTypes) === null || _b === void 0 ? void 0 : _b.getById(noteTypeId)) !== null && _c !== void 0 ? _c : null;
    }, [isEdit, editMode, plugin.cardStore, noteTypeId, refreshCounter]);
    const hasContent = useMemo(() => Object.values(fields).some((v) => v.trim().length > 0), [fields]);
    const canSave = useMemo(() => {
        var _a;
        const firstField = noteType === null || noteType === void 0 ? void 0 : noteType.fields[0];
        if (!firstField)
            return false;
        return ((_a = fields[firstField]) !== null && _a !== void 0 ? _a : "").trim().length > 0;
    }, [fields, noteType]);
    const sourceNoteFile = useMemo(() => {
        var _a, _b;
        if (showSourcePicker)
            return selectedSourceNote;
        const uid = (_a = addMode === null || addMode === void 0 ? void 0 : addMode.sourceUid) !== null && _a !== void 0 ? _a : editMode === null || editMode === void 0 ? void 0 : editMode.note.sourceUid;
        if (!uid)
            return null;
        const path = (_b = plugin.frontmatterIndex) === null || _b === void 0 ? void 0 : _b.getFileByValue("flashcard_uid", uid);
        if (!path)
            return null;
        const f = app.vault.getAbstractFileByPath(path);
        return f instanceof TFile ? f : null;
    }, [
        showSourcePicker,
        selectedSourceNote,
        addMode,
        editMode,
        plugin.frontmatterIndex,
    ]);
    useEffect(() => {
        onContentChange === null || onContentChange === void 0 ? void 0 : onContentChange(hasContent);
    }, [hasContent, onContentChange]);
    // Initialize empty fields when note type changes in add mode
    useEffect(() => {
        if (isEdit || !noteType)
            return;
        setFields((prev) => {
            var _a;
            const next = {};
            for (const fieldName of noteType.fields) {
                next[fieldName] = (_a = prev[fieldName]) !== null && _a !== void 0 ? _a : "";
            }
            return next;
        });
        // Clean up stale pins for fields no longer in the note type
        setPinnedFields((prev) => {
            const valid = new Set(noteType.fields);
            const next = new Set([...prev].filter((f) => valid.has(f)));
            return next.size === prev.size ? prev : next;
        });
    }, [noteType, isEdit]);
    // ── Handlers ──
    const handleFieldChange = useCallback((fieldName, value) => {
        setFields((prev) => (Object.assign(Object.assign({}, prev), { [fieldName]: value })));
    }, []);
    const handleNoteTypeChange = useCallback((id) => {
        setNoteTypeId(id);
    }, []);
    const handleChangeType = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!noteType || !(editMode === null || editMode === void 0 ? void 0 : editMode.noteId))
            return;
        const { ChangeNoteTypeModal } = yield import("@true-recall/obsidian/modals/library/ChangeNoteTypeModal");
        const allNoteTypes = plugin.cardStore.noteTypes.getAll();
        const modal = new ChangeNoteTypeModal(app, {
            currentNoteType: noteType,
            availableNoteTypes: allNoteTypes,
            noteCount: 1,
        });
        const result = yield modal.openAndWait();
        if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
            return;
        plugin.flashcardManager.changeNoteType(editMode.noteId, result.targetNoteTypeId, result.fieldMapping);
        onDone({ cancelled: false });
    }), [noteType, app, plugin, editMode, onDone]);
    const togglePin = useCallback((fieldName) => {
        setPinnedFields((prev) => {
            const next = new Set(prev);
            if (next.has(fieldName))
                next.delete(fieldName);
            else
                next.add(fieldName);
            return next;
        });
    }, []);
    const handleNoteTypeRefresh = useCallback(() => {
        setRefreshCounter((c) => c + 1);
    }, []);
    const openFields = useCallback(() => {
        const modal = new NoteTypeManagerModal(app, plugin);
        const origClose = modal.onClose.bind(modal);
        modal.onClose = () => {
            origClose();
            handleNoteTypeRefresh();
        };
        modal.open();
    }, [app, plugin, handleNoteTypeRefresh]);
    const openCards = useCallback(() => {
        const modal = new CardTypesEditorModal(app, plugin, noteTypeId);
        const origClose = modal.onClose.bind(modal);
        modal.onClose = () => {
            origClose();
            handleNoteTypeRefresh();
        };
        modal.open();
    }, [app, plugin, noteTypeId, handleNoteTypeRefresh]);
    const resolveSourceUid = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        // Edit mode: keep existing sourceUid
        if (isEdit)
            return editMode === null || editMode === void 0 ? void 0 : editMode.note.sourceUid;
        // Add mode with pre-set sourceUid (from review card)
        if (addMode === null || addMode === void 0 ? void 0 : addMode.sourceUid)
            return addMode === null || addMode === void 0 ? void 0 : addMode.sourceUid;
        // Add mode with selected source note
        if (!selectedSourceNote || !plugin.flashcardManager)
            return undefined;
        const fmService = plugin.flashcardManager.getFrontmatterService();
        let uid = yield fmService.getSourceNoteUid(selectedSourceNote.path);
        if (!uid) {
            uid = fmService.generateUid();
            yield fmService.setSourceNoteUid(selectedSourceNote.path, uid);
        }
        return uid;
    }), [isEdit, editMode, addMode, selectedSourceNote, plugin.flashcardManager]);
    const handleSave = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!noteType || !canSave || saving)
            return;
        if (!((_a = plugin.flashcardManager) === null || _a === void 0 ? void 0 : _a.hasStore())) {
            new Notice("Database not initialized");
            return;
        }
        setSaving(true);
        try {
            if (isEdit) {
                const unchanged = noteType.fields.every((f) => fields[f] === (editMode === null || editMode === void 0 ? void 0 : editMode.note.fields[f]));
                if (unchanged) {
                    onDone({ cancelled: true });
                    return;
                }
                if (!editMode)
                    return;
                const result = plugin.flashcardManager.updateNoteFields(editMode.noteId, fields);
                onDone({
                    cancelled: false,
                    updatedCardIds: result.updatedCardIds,
                });
            }
            else {
                const sourceUid = yield resolveSourceUid();
                const result = plugin.flashcardManager.createNote({
                    noteTypeId,
                    fields,
                    alwaysTypeIn,
                    sourceUid,
                    createdVia: "manual",
                });
                const totalCards = result.cards.length;
                new Notice(`Created ${totalCards} card${totalCards !== 1 ? "s" : ""}`);
                // Clear unpinned fields, keep pinned — modal stays open
                const next = {};
                for (const field of noteType.fields) {
                    next[field] = pinnedFields.has(field) ? ((_b = fields[field]) !== null && _b !== void 0 ? _b : "") : "";
                }
                setFields(next);
                setSaving(false);
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            new Notice(`Error: ${msg}`);
            setSaving(false);
        }
    }), [
        noteType,
        canSave,
        saving,
        isEdit,
        editMode,
        fields,
        noteTypeId,
        resolveSourceUid,
        alwaysTypeIn,
        plugin.flashcardManager,
        onDone,
        pinnedFields,
    ]);
    // Cmd/Ctrl+Enter saves from anywhere in the modal (not just CM fields).
    // CM fields also handle it via EmbeddableEditor's Scope — the `saving` guard prevents double-fire.
    const handleSaveRef = useRef(handleSave);
    handleSaveRef.current = handleSave;
    useEffect(() => {
        const onKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                void handleSaveRef.current();
            }
        };
        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
    }, []);
    if (!noteType) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-center ep:py-8", children: "Loading note types..." }));
    }
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3", children: [_jsx(ActionBar, { app: app, noteTypeId: noteTypeId, onNoteTypeChange: handleNoteTypeChange, isEdit: isEdit, onChangeType: isEdit ? () => void handleChangeType() : undefined, showSourcePicker: showSourcePicker, selectedSourceNote: selectedSourceNote, onSourceSelect: setSelectedSourceNote }), _jsx(FormattingToolbar, { app: app, getEditorView: () => { var _a, _b; return (_b = (_a = focusedFieldRef.current) === null || _a === void 0 ? void 0 : _a.editorView) !== null && _b !== void 0 ? _b : null; }, typeInEnabled: alwaysTypeIn, onTypeInToggle: !isEdit ? setAlwaysTypeIn : undefined }), _jsx(NoteFieldsForm, { noteType: noteType, fields: fields, onFieldChange: handleFieldChange, onFieldFocus: handleFieldFocus, onModEnter: () => void handleSave(), onEscape: onRequestClose, pinnedFields: pinnedFields, onTogglePin: togglePin }), _jsx(FooterBar, { app: app, isEdit: isEdit, canSave: canSave, saving: saving, requiresSourceNote: showSourcePicker && !selectedSourceNote, sourceNoteFile: sourceNoteFile, onSave: () => void handleSave(), onOpenFields: openFields, onOpenCards: openCards })] }));
}
const ghostBtnCls = "ep-btn ep-btn-ghost ep:text-ui-smaller ep:px-2 ep:py-1 ep:min-h-[28px] ep:max-h-[28px]";
function FooterBar({ app, isEdit, canSave, saving, requiresSourceNote, sourceNoteFile, onSave, onOpenFields, onOpenCards, }) {
    const aiIconRef = useIcon("wand");
    const openAI = useCallback(() => {
        new Notice("AI generation coming soon");
    }, []);
    const openNote = useCallback(() => {
        if (sourceNoteFile) {
            void app.workspace.getLeaf().openFile(sourceNoteFile);
        }
    }, [app, sourceNoteFile]);
    return (_jsxs("div", { class: "ep-modal-footer ep:flex ep:items-center ep:gap-2", children: [_jsx(Clickable, { class: ghostBtnCls, onClick: onOpenFields, stopPropagation: false, children: "Fields" }), _jsx(Clickable, { class: ghostBtnCls, onClick: onOpenCards, stopPropagation: false, children: "Cards" }), _jsx(Clickable, { ref: aiIconRef, title: "Generate with AI (coming soon)", class: `${ghostBtnCls} ep:ml-auto [&>svg]:ep:w-4 [&>svg]:ep:h-4`, onClick: openAI }), _jsx(Clickable, { class: ghostBtnCls, onClick: openNote, disabled: !sourceNoteFile, stopPropagation: false, children: "Open note" }), _jsx(Clickable, { class: "mod-cta ep-btn", onClick: onSave, disabled: !canSave || saving || requiresSourceNote, title: requiresSourceNote ? "Select a source note to save" : undefined, stopPropagation: false, children: isEdit ? "Save Changes" : "Save" })] }));
}
