import { SECONDARY_BTN } from "../../../../shared/ui/components/ModalFooter";

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
			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<button type="button" class={SECONDARY_BTN} onClick={onClose}>
					Close
				</button>
			</div>
		</>
	);
}
