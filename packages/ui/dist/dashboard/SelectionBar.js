import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
import { Clickable } from "../shared/Clickable";
export function SelectionBar({ selectedCount, onSelectAll, onCreateProject, onArchive, onStudy, onCancel, }) {
    const btnCls = "ep:px-2 ep:py-1 ep:rounded ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors";
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-secondary ep:rounded-lg ep:mb-2 ep:text-ui-small", children: [_jsxs("span", { class: "ep:text-obs-muted", children: [selectedCount, " selected"] }), _jsx("div", { class: "ep:flex-1" }), _jsx(Clickable, { class: btnCls, onClick: onSelectAll, children: "All" }), _jsx(Clickable, { class: btnCls, onClick: onCreateProject, disabled: selectedCount === 0, children: "Create project" }), _jsx(Clickable, { class: btnCls, onClick: onArchive, disabled: selectedCount === 0, children: "Archive" }), _jsx(Clickable, { class: btnCls, onClick: onStudy, disabled: selectedCount === 0, children: "Study" }), _jsx(Clickable, { class: btnCls, onClick: onCancel, children: "Cancel" })] }));
}
