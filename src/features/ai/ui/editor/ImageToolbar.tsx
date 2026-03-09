import { Clickable } from "@shared/ui/components";
import { useCallback } from "preact/hooks";

export interface ImageToolbarProps {
	imagePath: string;
	onQuickAdd: () => Promise<void>;
	onImageOcclusion: () => void;
	onDismiss: () => void;
}

export function ImageToolbar({
	imagePath,
	onQuickAdd,
	onImageOcclusion,
	onDismiss,
}: ImageToolbarProps) {
	const handleQuickAdd = useCallback(async () => {
		onDismiss();
		await onQuickAdd();
	}, [onQuickAdd, onDismiss]);

	const handleIO = useCallback(() => {
		onDismiss();
		onImageOcclusion();
	}, [onImageOcclusion, onDismiss]);

	return (
		<div class="true-recall-selection-toolbar ep:flex ep:items-center ep:gap-0.5 ep:p-1">
			<Clickable
				class="true-recall-st-btn"
				onClick={() => void handleQuickAdd()}
				title={`Quick add image as flashcard question`}
			>
				<span>Quick+</span>
			</Clickable>

			<span class="true-recall-st-divider" />

			<Clickable
				class="true-recall-st-btn"
				onClick={handleIO}
				title="Create image occlusion card"
			>
				<span>IO</span>
			</Clickable>
		</div>
	);
}
