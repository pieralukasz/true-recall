import { Clickable } from "@shared/ui/components/Clickable";
import type { ComponentChildren } from "preact";

const PRIMARY_BTN = "mod-cta ep-btn";
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
			<Clickable
				class={SECONDARY_BTN}
				onClick={onCancel}
				stopPropagation={false}
			>
				{cancelLabel}
			</Clickable>
			{onConfirm && (
				<Clickable
					class={PRIMARY_BTN}
					onClick={onConfirm}
					disabled={confirmDisabled || loading}
					stopPropagation={false}
				>
					{loading ? "..." : confirmLabel}
				</Clickable>
			)}
		</div>
	);
}
