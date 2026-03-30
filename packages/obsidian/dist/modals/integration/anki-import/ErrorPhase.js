import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { ModalFooter, SECONDARY_BTN } from "@true-recall/obsidian/components/ModalFooter";
export function ErrorPhase({ message, canRetry, onRetry, onClose, }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { class: "ep:text-ui-small ep:text-red-500 ep:py-4 ep:text-center", children: [canRetry ? "Failed to parse file: " : "Import failed: ", message] }), _jsx(ModalFooter, { onCancel: onClose, cancelLabel: "Close", children: canRetry && (_jsx(Clickable, { stopPropagation: false, class: SECONDARY_BTN, onClick: onRetry, children: "Try again" })) })] }));
}
