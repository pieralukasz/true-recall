import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { SECONDARY_BTN } from "@true-recall/obsidian/components/ModalFooter";
export function ErrorPhase({ message, onClose }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { class: "ep:text-ui-small ep:text-red-500 ep:py-4 ep:text-center", children: ["Export failed: ", message] }), _jsx("div", { class: "ep-modal-footer ep:flex ep:justify-end ep:gap-2", children: _jsx(Clickable, { stopPropagation: false, class: SECONDARY_BTN, onClick: onClose, children: "Close" }) })] }));
}
