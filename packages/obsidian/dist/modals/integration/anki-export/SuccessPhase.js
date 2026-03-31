import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { PRIMARY_BTN } from "@true-recall/obsidian/components/ModalFooter";
export function SuccessPhase({ filename, onClose }) {
    return (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:text-center ep:py-6", children: _jsxs("div", { class: "ep:text-ui-small ep:font-medium ep:text-green-500", children: ["Exported as ", filename] }) }), _jsx("div", { class: "ep-modal-footer ep:flex ep:justify-end ep:gap-2", children: _jsx(Clickable, { stopPropagation: false, class: PRIMARY_BTN, onClick: onClose, children: "Done" }) })] }));
}
