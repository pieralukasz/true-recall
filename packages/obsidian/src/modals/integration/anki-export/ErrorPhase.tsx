import { Clickable } from "@true-recall/obsidian/components";
import { SECONDARY_BTN } from "@true-recall/obsidian/components/ModalFooter";

export interface ErrorPhaseProps {
	message: string;
	onClose: () => void;
}

export function ErrorPhase({ message, onClose }: ErrorPhaseProps) {
	return (
		<>
			<div class="ep:text-ui-small ep:text-red-500 ep:py-4 ep:text-center">
				Export failed: {message}
			</div>
			<div class="ep-modal-footer ep:flex ep:justify-end ep:gap-2">
				<Clickable
					stopPropagation={false}
					class={SECONDARY_BTN}
					onClick={onClose}
				>
					Close
				</Clickable>
			</div>
		</>
	);
}
