import {
	Clickable,
	ModalFooter,
	SECONDARY_BTN,
} from "@true-recall/obsidian/components";

export interface ErrorPhaseProps {
	message: string;
	canRetry: boolean;
	onRetry: () => void;
	onClose: () => void;
}

export function ErrorPhase({
	message,
	canRetry,
	onRetry,
	onClose,
}: ErrorPhaseProps) {
	return (
		<>
			<div class="ep:text-ui-small ep:text-red-500 ep:py-4 ep:text-center">
				{canRetry ? "Failed to parse file: " : "Import failed: "}
				{message}
			</div>
			<ModalFooter onCancel={onClose} cancelLabel="Close">
				{canRetry && (
					<Clickable
						stopPropagation={false}
						class={SECONDARY_BTN}
						onClick={onRetry}
					>
						Try again
					</Clickable>
				)}
			</ModalFooter>
		</>
	);
}
