import { ActionButton } from "@true-recall/obsidian/components";

interface SuccessPhaseProps {
	filename: string;
	onClose: () => void;
}

export function SuccessPhase({ filename, onClose }: SuccessPhaseProps) {
	return (
		<>
			<div class="ep:text-center ep:py-6">
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-green">
					Exported as {filename}
				</div>
			</div>
			<div class="ep-modal-footer ep:flex ep:justify-end ep:gap-2">
				<ActionButton label="Done" variant="primary" onClick={onClose} />
			</div>
		</>
	);
}
