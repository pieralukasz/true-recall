import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { NoteTypePicker } from "@true-recall/obsidian/modals/core/add-flashcards/NoteTypePicker";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { NotePickerCombobox } from "@true-recall/obsidian/components/NotePickerCombobox";
export function ActionBar({ app, noteTypeId, onNoteTypeChange, isEdit, onChangeType, showSourcePicker, selectedSourceNote, onSourceSelect, }) {
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx(NoteTypePicker, { value: noteTypeId, onChange: onNoteTypeChange, disabled: isEdit }), isEdit && onChangeType && (_jsx(Clickable, { class: "ep:text-ui-smaller ep:text-obs-accent hover:ep:underline", onClick: onChangeType, children: "Change" })), showSourcePicker && (_jsx("div", { class: "ep:flex-1 ep:min-w-[60%]", children: _jsx(NotePickerCombobox, { app: app, selectedNote: selectedSourceNote, onSelect: onSourceSelect }) }))] }));
}
