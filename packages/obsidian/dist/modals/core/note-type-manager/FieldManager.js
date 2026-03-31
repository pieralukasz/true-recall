import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/ui/utils/cn";
import { useCallback, useState } from "preact/hooks";
export function FieldManager({ fields, readOnly, onFieldsChange, onFieldRename, }) {
    const [newFieldName, setNewFieldName] = useState("");
    const [editingIndex, setEditingIndex] = useState(null);
    const [editValue, setEditValue] = useState("");
    const handleAdd = useCallback(() => {
        const name = newFieldName.trim();
        if (!name || fields.includes(name))
            return;
        onFieldsChange([...fields, name]);
        setNewFieldName("");
    }, [newFieldName, fields, onFieldsChange]);
    const handleRemove = useCallback((index) => {
        if (fields.length <= 1)
            return;
        onFieldsChange(fields.filter((_, i) => i !== index));
    }, [fields, onFieldsChange]);
    const handleMove = useCallback((index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= fields.length)
            return;
        const next = [...fields];
        const temp = next[index];
        const swapTarget = next[target];
        if (temp === undefined || swapTarget === undefined)
            return;
        next[index] = swapTarget;
        next[target] = temp;
        onFieldsChange(next);
    }, [fields, onFieldsChange]);
    const startEdit = useCallback((index) => {
        if (readOnly)
            return;
        const field = fields[index];
        if (field === undefined)
            return;
        setEditingIndex(index);
        setEditValue(field);
    }, [readOnly, fields]);
    const commitEdit = useCallback(() => {
        if (editingIndex === null)
            return;
        const trimmed = editValue.trim();
        const oldName = fields[editingIndex];
        if (oldName === undefined)
            return;
        if (trimmed && trimmed !== oldName && !fields.includes(trimmed)) {
            if (onFieldRename) {
                onFieldRename(oldName, trimmed);
            }
            else {
                const next = [...fields];
                next[editingIndex] = trimmed;
                onFieldsChange(next);
            }
        }
        setEditingIndex(null);
    }, [editingIndex, editValue, fields, onFieldRename, onFieldsChange]);
    return (_jsxs("div", { children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:text-obs-muted ep:mb-2", children: "Fields" }), _jsx("div", { class: "ep:space-y-1", children: fields.map((field, i) => (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-1.5 ep:py-0.5", children: [editingIndex === i ? (_jsx("input", { type: "text", class: "ep:flex-1 ep:px-2 ep:py-0.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-accent ep:rounded", value: editValue, onInput: (e) => setEditValue(e.target.value), onBlur: commitEdit, onKeyDown: (e) => {
                                if (e.key === "Enter")
                                    commitEdit();
                                if (e.key === "Escape")
                                    setEditingIndex(null);
                            } })) : (_jsx(Clickable, { class: cn("ep:flex-1 ep:px-2 ep:py-0.5 ep:text-ui-small ep:rounded", !readOnly && "ep:hover:bg-obs-hover ep:cursor-text"), onClick: () => startEdit(i), disabled: readOnly, children: field })), !readOnly && (_jsxs(_Fragment, { children: [_jsx(Clickable, { class: "ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:px-0.5", onClick: () => handleMove(i, -1), disabled: i === 0, children: "\u2191" }), _jsx(Clickable, { class: "ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:px-0.5", onClick: () => handleMove(i, 1), disabled: i === fields.length - 1, children: "\u2193" }), _jsx(Clickable, { class: "ep:text-ui-smaller ep:text-obs-error ep:hover:text-obs-error/80 ep:px-0.5", onClick: () => handleRemove(i), disabled: fields.length <= 1, children: "\u2715" })] }))] }, `${field}-${i}`))) }), !readOnly && (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:mt-2", children: [_jsx("input", { type: "text", class: "ep:flex-1 ep:px-2 ep:py-1 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded", placeholder: "New field name", value: newFieldName, onInput: (e) => setNewFieldName(e.target.value), onKeyDown: (e) => {
                            if (e.key === "Enter")
                                handleAdd();
                        } }), _jsx(Clickable, { class: "ep:text-ui-small ep:text-obs-accent ep:hover:text-obs-accent/80 ep:px-2 ep:py-1", onClick: handleAdd, disabled: !newFieldName.trim() || fields.includes(newFieldName.trim()), children: "Add" })] }))] }));
}
