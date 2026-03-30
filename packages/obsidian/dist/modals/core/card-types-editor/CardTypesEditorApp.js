import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { Notice } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { FieldManager } from "../note-type-manager/FieldManager";
import { BottomBar } from "./BottomBar";
import { CardTypeDropdown } from "./CardTypeDropdown";
import { EditorTabs } from "./EditorTabs";
import { FieldChips } from "./FieldChips";
import { OptionsMenu } from "./OptionsMenu";
import { TemplateCodeEditor } from "./TemplateCodeEditor";
export function CardTypesEditorApp({ noteTypeId, onClose, onTitleChange, }) {
    var _a, _b, _c;
    const plugin = usePlugin();
    const noteTypeService = plugin.noteTypeService;
    const [version, setVersion] = useState(0);
    const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
    const [activeTab, setActiveTab] = useState("front");
    const [showFields, setShowFields] = useState(false);
    const noteType = useMemo(() => noteTypeService.getById(noteTypeId), 
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version signal triggers re-fetch when note type data changes
    [noteTypeService, noteTypeId, version]);
    const readOnly = (_a = noteType === null || noteType === void 0 ? void 0 : noteType.isBuiltin) !== null && _a !== void 0 ? _a : true;
    const selectedTemplate = (_b = noteType === null || noteType === void 0 ? void 0 : noteType.templates[selectedTemplateIndex]) !== null && _b !== void 0 ? _b : null;
    useEffect(() => {
        if (noteType) {
            onTitleChange(`Card Types for "${noteType.name}"`);
        }
    }, [noteType === null || noteType === void 0 ? void 0 : noteType.name, onTitleChange]);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);
    const editorValue = useMemo(() => {
        var _a;
        if (!selectedTemplate)
            return "";
        switch (activeTab) {
            case "front":
                return selectedTemplate.qfmt;
            case "back":
                return selectedTemplate.afmt;
            case "styling":
                return (_a = noteType === null || noteType === void 0 ? void 0 : noteType.css) !== null && _a !== void 0 ? _a : "";
        }
    }, [selectedTemplate, activeTab, noteType === null || noteType === void 0 ? void 0 : noteType.css]);
    const handleEditorChange = useCallback((value) => {
        if (!noteType || readOnly)
            return;
        try {
            if (activeTab === "styling") {
                noteTypeService.update(noteType.id, { css: value });
            }
            else {
                const templates = [...noteType.templates];
                const current = templates[selectedTemplateIndex];
                if (!current)
                    return;
                templates[selectedTemplateIndex] = Object.assign(Object.assign({}, current), { [activeTab === "front" ? "qfmt" : "afmt"]: value });
                noteTypeService.update(noteType.id, { templates });
            }
            refresh();
        }
        catch (e) {
            new Notice(e.message);
        }
    }, [
        noteType,
        readOnly,
        activeTab,
        selectedTemplateIndex,
        noteTypeService,
        refresh,
    ]);
    const handleAddTemplate = useCallback(() => {
        if (!noteType || readOnly)
            return;
        const ordinal = noteType.templates.length;
        const templates = [
            ...noteType.templates,
            { name: `Card ${ordinal + 1}`, ordinal, qfmt: "", afmt: "" },
        ];
        try {
            noteTypeService.update(noteType.id, { templates });
            setSelectedTemplateIndex(ordinal);
            refresh();
        }
        catch (e) {
            new Notice(e.message);
        }
    }, [noteType, readOnly, noteTypeService, refresh]);
    const handleRemoveTemplate = useCallback(() => {
        if (!noteType || readOnly || noteType.templates.length <= 1)
            return;
        const templates = noteType.templates
            .filter((_, i) => i !== selectedTemplateIndex)
            .map((t, i) => (Object.assign(Object.assign({}, t), { ordinal: i })));
        try {
            noteTypeService.update(noteType.id, { templates });
            setSelectedTemplateIndex(Math.max(0, selectedTemplateIndex - 1));
            refresh();
        }
        catch (e) {
            new Notice(e.message);
        }
    }, [noteType, readOnly, selectedTemplateIndex, noteTypeService, refresh]);
    const handleRenameTemplate = useCallback((newName) => {
        if (!noteType || readOnly)
            return;
        const templates = [...noteType.templates];
        const current = templates[selectedTemplateIndex];
        if (!current)
            return;
        templates[selectedTemplateIndex] = Object.assign(Object.assign({}, current), { name: newName });
        try {
            noteTypeService.update(noteType.id, { templates });
            refresh();
        }
        catch (e) {
            new Notice(e.message);
        }
    }, [noteType, readOnly, selectedTemplateIndex, noteTypeService, refresh]);
    const handleFlip = useCallback(() => {
        if (!noteType || readOnly)
            return;
        const templates = [...noteType.templates];
        const current = templates[selectedTemplateIndex];
        if (!current)
            return;
        templates[selectedTemplateIndex] = Object.assign(Object.assign({}, current), { qfmt: current.afmt, afmt: current.qfmt });
        try {
            noteTypeService.update(noteType.id, { templates });
            refresh();
        }
        catch (e) {
            new Notice(e.message);
        }
    }, [noteType, readOnly, selectedTemplateIndex, noteTypeService, refresh]);
    const handleFieldsChange = useCallback((fields) => {
        if (!noteType)
            return;
        try {
            noteTypeService.update(noteType.id, { fields });
            refresh();
        }
        catch (e) {
            new Notice(e.message);
        }
    }, [noteType, noteTypeService, refresh]);
    const handleFieldRename = useCallback((oldName, newName) => {
        if (!noteType)
            return;
        try {
            noteTypeService.renameField(noteType.id, oldName, newName);
            refresh();
        }
        catch (e) {
            new Notice(e.message);
        }
    }, [noteType, noteTypeService, refresh]);
    if (!noteType) {
        return (_jsx("div", { class: "ep:flex ep:items-center ep:justify-center ep:h-full ep:text-obs-muted", children: "Note type not found" }));
    }
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:h-[65vh]", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-3 ep:pb-3 ep:border-b ep:border-obs-border", children: [_jsx("span", { class: "ep:text-ui-small ep:text-obs-muted ep:shrink-0", children: "Card Type:" }), _jsx(CardTypeDropdown, { templates: noteType.templates, selectedIndex: selectedTemplateIndex, onChange: setSelectedTemplateIndex }), !readOnly && (_jsx(OptionsMenu, { onAdd: handleAddTemplate, onRemove: handleRemoveTemplate, onRename: handleRenameTemplate, currentName: (_c = selectedTemplate === null || selectedTemplate === void 0 ? void 0 : selectedTemplate.name) !== null && _c !== void 0 ? _c : "", canRemove: noteType.templates.length > 1 }))] }), _jsx(EditorTabs, { activeTab: activeTab, onTabChange: setActiveTab }), _jsxs("div", { class: "ep:flex-1 ep:min-h-0 ep:flex ep:flex-col ep:py-3", children: [activeTab === "styling" && (_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mb-2", children: "CSS styling shared across all card types" })), _jsx("div", { class: "ep:flex-1 ep:min-h-0", children: _jsx(TemplateCodeEditor, { value: editorValue, readOnly: readOnly, onChange: handleEditorChange, tall: true }, `${noteType.id}-${selectedTemplateIndex}-${activeTab}`) }), activeTab !== "styling" && (_jsx(FieldChips, { fields: noteType.fields, noteTypeType: noteType.type }))] }), showFields && !readOnly && (_jsx("div", { class: "ep:border-t ep:border-obs-border ep:pt-3 ep:pb-2 ep:max-h-[200px] ep:overflow-y-auto", children: _jsx(FieldManager, { fields: noteType.fields, readOnly: false, onFieldsChange: handleFieldsChange, onFieldRename: handleFieldRename }) })), _jsx(BottomBar, { readOnly: readOnly, showFields: showFields, onToggleFields: () => setShowFields((v) => !v), onFlip: handleFlip, onClose: onClose })] }));
}
