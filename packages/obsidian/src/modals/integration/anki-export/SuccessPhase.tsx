import { Clickable } from "@true-recall/obsidian/components";
import { PRIMARY_BTN } from "@true-recall/obsidian/components/ModalFooter";

export interface SuccessPhaseProps {
	filename: string;
	onClose: () => void;
}

export function SuccessPhase({ filename, onClose }: SuccessPhaseProps) {
	return (
		<>
			<div class="ep:text-center ep:py-6">
				<div class="ep:text-ui-small ep:font-medium ep:text-green-500">
					Exported as {filename}
				</div>
			</div>
			<div class="ep-modal-footer ep:flex ep:justify-end ep:gap-2">
				<Clickable
					stopPropagation={false}
					class={PRIMARY_BTN}
					onClick={onClose}
				>
					Done
				</Clickable>
			</div>
		</>
	);
}
