import type { ComponentChildren } from "preact";
/** @deprecated Use ActionButton variant="primary" instead */
declare const PRIMARY_BTN = "mod-cta ep-btn";
/** @deprecated Use ActionButton variant="outline" instead */
declare const SECONDARY_BTN = "ep-btn ep-btn-outline";
export { PRIMARY_BTN, SECONDARY_BTN };
export interface ModalFooterProps {
    onCancel: () => void;
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmDisabled?: boolean;
    loading?: boolean;
    children?: ComponentChildren;
}
export declare function ModalFooter({ onCancel, onConfirm, confirmLabel, cancelLabel, confirmDisabled, loading, children, }: ModalFooterProps): import("preact").JSX.Element;
