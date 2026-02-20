import { PRIMARY_BTN } from "@shared/ui/components/ModalFooter";

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
			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<button type="button" class={PRIMARY_BTN} onClick={onClose}>
					Done
				</button>
			</div>
		</>
	);
}
