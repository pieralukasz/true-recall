import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { ActionButton } from "./ActionButton";
import { Clickable } from "./Clickable";
/** @deprecated Use ActionButton variant="primary" instead */
const PRIMARY_BTN = "mod-cta ep-btn";
/** @deprecated Use ActionButton variant="outline" instead */
const SECONDARY_BTN = "ep-btn ep-btn-outline";
export { PRIMARY_BTN, SECONDARY_BTN };
export function ModalFooter({ onCancel, onConfirm, confirmLabel = "Confirm", cancelLabel = "Cancel", confirmDisabled = false, loading = false, children, }) {
    return (_jsxs("div", { class: "ep-modal-footer ep:flex ep:justify-end ep:gap-2", children: [children, _jsx(Clickable, { class: SECONDARY_BTN, onClick: onCancel, stopPropagation: false, children: cancelLabel }), onConfirm && (_jsx(ActionButton, { label: loading ? "..." : confirmLabel, variant: "primary", onClick: onConfirm, disabled: confirmDisabled || loading }))] }));
}
