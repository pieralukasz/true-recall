import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { BUILTIN_IMAGE_OCCLUSION_ID } from "@true-recall/core/types/note.types";
import { Clickable } from "@true-recall/obsidian/components";
import { useCallback, useMemo, useState } from "preact/hooks";
export function ChangeNoteTypeBody({ currentNoteType, availableNoteTypes, onResolve, }) {
    const targetTypes = useMemo(() => availableNoteTypes.filter((nt) => nt.id !== currentNoteType.id && nt.id !== BUILTIN_IMAGE_OCCLUSION_ID), [availableNoteTypes, currentNoteType.id]);
    const [selectedTypeId, setSelectedTypeId] = useState("");
    const selectedType = targetTypes.find((nt) => nt.id === selectedTypeId);
    // Field mapping: newFieldName → oldFieldName (or "" for empty)
    const [fieldMapping, setFieldMapping] = useState({});
    // Auto-map fields by name when target type changes
    const handleTypeChange = useCallback((typeId) => {
        setSelectedTypeId(typeId);
        const target = targetTypes.find((nt) => nt.id === typeId);
        if (!target) {
            setFieldMapping({});
            return;
        }
        const autoMap = {};
        for (const field of target.fields) {
            if (currentNoteType.fields.includes(field)) {
                autoMap[field] = field;
            }
            else {
                autoMap[field] = "";
            }
        }
        setFieldMapping(autoMap);
    }, [targetTypes, currentNoteType.fields]);
    const updateMapping = useCallback((newField, oldField) => {
        setFieldMapping((prev) => (Object.assign(Object.assign({}, prev), { [newField]: oldField })));
    }, []);
    const handleConfirm = useCallback(() => {
        if (!selectedTypeId)
            return;
        onResolve({
            cancelled: false,
            targetNoteTypeId: selectedTypeId,
            fieldMapping,
        });
    }, [selectedTypeId, fieldMapping, onResolve]);
    const handleCancel = useCallback(() => {
        onResolve({ cancelled: true });
    }, [onResolve]);
    // Count how many old fields will be discarded
    const mappedOldFields = new Set(Object.values(fieldMapping).filter(Boolean));
    const discardedFields = currentNoteType.fields.filter((f) => !mappedOldFields.has(f));
    return (_jsxs("div", { class: "ep:space-y-4", children: [_jsxs("div", { children: [_jsx("div", { class: "ep:block ep:text-ui-smaller ep:text-obs-muted ep:mb-1", children: "Current type" }), _jsxs("div", { class: "ep:text-ui-small ep:font-medium ep:text-obs-normal", children: [currentNoteType.name, _jsxs("span", { class: "ep:text-obs-faint ep:ml-2", children: ["(", currentNoteType.fields.join(", "), ")"] })] })] }), _jsxs("div", { children: [_jsx("div", { class: "ep:block ep:text-ui-smaller ep:text-obs-muted ep:mb-1", children: "New type" }), _jsxs("select", { class: "ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded", value: selectedTypeId, onChange: (e) => handleTypeChange(e.target.value), children: [_jsx("option", { value: "", children: "Select note type..." }), targetTypes.map((nt) => (_jsxs("option", { value: nt.id, children: [nt.name, " (", nt.fields.join(", "), ")"] }, nt.id)))] })] }), selectedType && (_jsxs("div", { children: [_jsx("div", { class: "ep:block ep:text-ui-smaller ep:text-obs-muted ep:mb-2", children: "Field mapping" }), _jsx("div", { class: "ep:space-y-2", children: selectedType.fields.map((newField) => {
                            var _a;
                            return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("span", { class: "ep:text-ui-small ep:text-obs-normal ep:w-28 ep:truncate ep:shrink-0", children: newField }), _jsx("span", { class: "ep:text-obs-faint ep:text-ui-smaller", children: "\u2190" }), _jsxs("select", { class: "ep:flex-1 ep:px-2 ep:py-1 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded", value: (_a = fieldMapping[newField]) !== null && _a !== void 0 ? _a : "", onChange: (e) => updateMapping(newField, e.target.value), children: [_jsx("option", { value: "", children: "(empty)" }), currentNoteType.fields.map((oldField) => (_jsx("option", { value: oldField, children: oldField }, oldField)))] })] }, newField));
                        }) })] })), selectedType && discardedFields.length > 0 && (_jsxs("div", { class: "ep:text-ui-smaller ep:text-obs-warning ep:leading-relaxed", children: ["Fields not mapped will lose their content:", " ", _jsx("strong", { children: discardedFields.join(", ") })] })), _jsxs("div", { class: "ep:flex ep:justify-end ep:gap-2 ep:pt-2", children: [_jsx(Clickable, { class: "ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded ep:border ep:border-obs-border ep:text-obs-muted hover:ep:bg-obs-modifier-hover", onClick: handleCancel, stopPropagation: false, children: "Cancel" }), _jsx(Clickable, { class: "mod-cta ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded", onClick: handleConfirm, disabled: !selectedTypeId, stopPropagation: false, children: "Change type" })] })] }));
}
