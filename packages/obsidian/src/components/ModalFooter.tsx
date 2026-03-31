import type { ComponentChildren } from "preact";
import { ActionButton } from "./ActionButton";

/** @deprecated Use ActionButton variant="primary" instead */
const PRIMARY_BTN = "mod-cta ep-btn";
/** @deprecated Use ActionButton variant="outline" instead */
const SECONDARY_BTN = "ep-btn ep-btn-outline";

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

export function ModalFooter({
	onCancel,
	onConfirm,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	confirmDisabled = false,
	loading = false,
	children,
}: ModalFooterProps) {
	return (
		<div class="ep-modal-footer ep:flex ep:justify-end ep:gap-2">
			{children}
			<ActionButton label={cancelLabel} variant="outline" onClick={onCancel} />
			{onConfirm && (
				<ActionButton
					label={loading ? "..." : confirmLabel}
					variant="primary"
					onClick={onConfirm}
					disabled={confirmDisabled || loading}
				/>
			)}
		</div>
	);
}
