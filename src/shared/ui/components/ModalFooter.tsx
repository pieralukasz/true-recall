import type { ComponentChildren } from "preact";

const PRIMARY_BTN =
	"mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all";
const SECONDARY_BTN =
	"ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover";

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
		<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-4 ep:border-t ep:border-obs-border">
			{children}
			<button type="button" class={SECONDARY_BTN} onClick={onCancel}>
				{cancelLabel}
			</button>
			{onConfirm && (
				<button
					type="button"
					class={PRIMARY_BTN}
					onClick={onConfirm}
					disabled={confirmDisabled || loading}
				>
					{loading ? "..." : confirmLabel}
				</button>
			)}
		</div>
	);
}
