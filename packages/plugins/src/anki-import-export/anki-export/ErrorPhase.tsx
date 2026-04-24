import { ActionButton } from "@true-recall/obsidian/components";

interface ErrorPhaseProps {
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
				<ActionButton label="Close" variant="outline" onClick={onClose} />
			</div>
		</>
	);
}
