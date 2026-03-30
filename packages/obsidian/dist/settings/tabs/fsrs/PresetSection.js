import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { ActionButton, FormCard, FormField, SelectInput, TextInput, } from "@true-recall/obsidian/components";
export function PresetSection({ presets, preset, isDefault, selectedPresetId, onPresetChange, onCreate, onDelete, onRename, }) {
    return (_jsxs(FormCard, { title: "FSRS presets", children: [_jsxs(FormField, { name: "Active preset", description: "Each preset has its own retention target, weights, steps, and daily limits", children: [_jsx(SelectInput, { value: selectedPresetId, onChange: onPresetChange, options: presets.map((p) => ({ value: p.id, label: p.name })) }), _jsx(ActionButton, { label: "New", variant: "secondary", onClick: onCreate }), !isDefault && (_jsx(ActionButton, { label: "Delete", variant: "danger", onClick: onDelete }))] }), !isDefault && (_jsx(FormField, { name: "Preset name", children: _jsx(TextInput, { value: preset.name, onChange: (v) => {
                        if (v.trim())
                            onRename(v.trim());
                    } }) }))] }));
}
