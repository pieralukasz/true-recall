import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { useCallback } from "preact/hooks";
import { FieldManager } from "./FieldManager";
import { TemplateEditor } from "./TemplateEditor";
export function NoteTypeEditor(props) {
    if (props.mode === "create") {
        return _jsx(CreateEditor, Object.assign({}, props));
    }
    return _jsx(ViewEditEditor, Object.assign({}, props));
}
// ── Create mode ──────────────────────────────────────────────
function CreateEditor({ draft, onDraftChange, onSave, onCancel, }) {
    const updateDraft = useCallback((partial) => onDraftChange(Object.assign(Object.assign({}, draft), partial)), [draft, onDraftChange]);
    const updateTemplate = useCallback((index, updated) => {
        const templates = [...draft.templates];
        templates[index] = updated;
        updateDraft({ templates });
    }, [draft.templates, updateDraft]);
    const addTemplate = useCallback(() => {
        const ordinal = draft.templates.length;
        updateDraft({
            templates: [
                ...draft.templates,
                {
                    name: `Card ${ordinal + 1}`,
                    ordinal,
                    qfmt: "",
                    afmt: "",
                },
            ],
        });
    }, [draft.templates, updateDraft]);
    const removeTemplate = useCallback((index) => {
        if (draft.templates.length <= 1)
            return;
        const templates = draft.templates
            .filter((_, i) => i !== index)
            .map((t, i) => (Object.assign(Object.assign({}, t), { ordinal: i })));
        updateDraft({ templates });
    }, [draft.templates, updateDraft]);
    const canSave = draft.name.trim().length > 0 &&
        draft.fields.length > 0 &&
        draft.templates.length > 0;
    return (_jsxs("div", { class: "ep:space-y-4", children: [_jsxs("div", { children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:text-obs-muted ep:mb-1", children: "Name" }), _jsx("input", { type: "text", class: "ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded", placeholder: "My Custom Note Type", value: draft.name, onInput: (e) => updateDraft({ name: e.target.value }) })] }), _jsx(FieldManager, { fields: draft.fields, readOnly: false, onFieldsChange: (fields) => updateDraft({ fields }) }), _jsxs("div", { children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:text-obs-muted ep:mb-2", children: "Templates" }), _jsx("div", { class: "ep:space-y-3", children: draft.templates.map((t, i) => (_jsx(TemplateEditor, { template: t, fields: draft.fields, readOnly: false, noteTypeType: draft.type, onTemplateChange: (updated) => updateTemplate(i, updated), onDelete: () => removeTemplate(i), isOnlyTemplate: draft.templates.length <= 1 }, t.ordinal))) }), _jsx(Clickable, { class: "ep:text-ui-small ep:text-obs-accent ep:hover:text-obs-accent/80 ep:mt-2", onClick: addTemplate, children: "+ Add template" })] }), _jsxs("div", { class: "ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border", children: [_jsx(Clickable, { class: "ep:px-4 ep:py-1.5 ep:text-ui-small ep:text-obs-muted ep:hover:text-obs-normal ep:rounded", onClick: onCancel, children: "Cancel" }), _jsx(Clickable, { class: "ep:px-4 ep:py-1.5 ep:text-ui-small ep:bg-obs-accent ep:text-obs-on-accent ep:rounded ep:hover:opacity-90", onClick: onSave, disabled: !canSave, children: "Create" })] })] }));
}
// ── View / Edit mode ─────────────────────────────────────────
function ViewEditEditor({ mode, noteType, noteTypeService, onRefresh, onDelete, }) {
    const readOnly = mode === "view";
    const handleNameChange = useCallback((e) => {
        const name = e.target.value.trim();
        if (name && name !== noteType.name) {
            try {
                noteTypeService.update(noteType.id, { name });
                onRefresh();
            }
            catch (_a) {
                // revert handled by refresh
            }
        }
    }, [noteType, noteTypeService, onRefresh]);
    const handleFieldsChange = useCallback((fields) => {
        try {
            noteTypeService.update(noteType.id, { fields });
            onRefresh();
        }
        catch (_a) {
            // validation error
        }
    }, [noteType.id, noteTypeService, onRefresh]);
    const handleFieldRename = useCallback((oldName, newName) => {
        try {
            noteTypeService.renameField(noteType.id, oldName, newName);
            onRefresh();
        }
        catch (_a) {
            // validation error
        }
    }, [noteType.id, noteTypeService, onRefresh]);
    const handleTemplateChange = useCallback((index, updated) => {
        const templates = [...noteType.templates];
        templates[index] = updated;
        try {
            noteTypeService.update(noteType.id, { templates });
            onRefresh();
        }
        catch (_a) {
            // validation error
        }
    }, [noteType, noteTypeService, onRefresh]);
    const handleAddTemplate = useCallback(() => {
        const ordinal = noteType.templates.length;
        const templates = [
            ...noteType.templates,
            { name: `Card ${ordinal + 1}`, ordinal, qfmt: "", afmt: "" },
        ];
        try {
            noteTypeService.update(noteType.id, { templates });
            onRefresh();
        }
        catch (_a) {
            // validation error
        }
    }, [noteType, noteTypeService, onRefresh]);
    const handleRemoveTemplate = useCallback((index) => {
        if (noteType.templates.length <= 1)
            return;
        const templates = noteType.templates
            .filter((_, i) => i !== index)
            .map((t, i) => (Object.assign(Object.assign({}, t), { ordinal: i })));
        try {
            noteTypeService.update(noteType.id, { templates });
            onRefresh();
        }
        catch (_a) {
            // validation error
        }
    }, [noteType, noteTypeService, onRefresh]);
    return (_jsxs("div", { class: "ep:space-y-4", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsxs("div", { class: "ep:flex-1", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:text-obs-muted ep:mb-1", children: "Name" }), _jsx("input", { type: "text", class: "ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded", value: noteType.name, disabled: readOnly, onBlur: handleNameChange })] }), _jsx("span", { class: "ep:text-ui-smaller ep:px-2 ep:py-0.5 ep:rounded ep:bg-obs-accent/10 ep:text-obs-accent ep:mt-5", children: noteType.type === 1 ? "Cloze" : "Standard" })] }), readOnly && (_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:italic", children: "Built-in note types cannot be modified" })), _jsx(FieldManager, { fields: noteType.fields, readOnly: readOnly, onFieldsChange: handleFieldsChange, onFieldRename: handleFieldRename }), _jsxs("div", { children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:text-obs-muted ep:mb-2", children: "Templates" }), _jsx("div", { class: "ep:space-y-3", children: noteType.templates.map((t, i) => (_jsx(TemplateEditor, { template: t, fields: noteType.fields, readOnly: readOnly, noteTypeType: noteType.type, onTemplateChange: (updated) => handleTemplateChange(i, updated), onDelete: () => handleRemoveTemplate(i), isOnlyTemplate: noteType.templates.length <= 1 }, `${noteType.id}-${t.ordinal}`))) }), !readOnly && (_jsx(Clickable, { class: "ep:text-ui-small ep:text-obs-accent ep:hover:text-obs-accent/80 ep:mt-2", onClick: handleAddTemplate, children: "+ Add template" }))] }), !readOnly && (_jsx("div", { class: "ep:pt-2 ep:border-t ep:border-obs-border", children: _jsx(Clickable, { class: "ep:text-ui-small ep:text-obs-error ep:hover:text-obs-error/80", onClick: () => onDelete(noteType.id), children: "Delete note type" }) }))] }));
}
