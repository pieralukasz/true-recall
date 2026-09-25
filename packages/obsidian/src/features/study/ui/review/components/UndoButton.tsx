import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";

interface UndoButtonProps {
	disabled: boolean;
	onUndo: () => void;
}

export function UndoButton({ disabled, onUndo }: UndoButtonProps) {
	const iconRef = useIcon("undo");

	return (
		<Clickable
			class="true-recall-review-undo ep:flex ep:items-center ep:justify-center ep:rounded-md ep:border ep:border-obs-border ep:bg-obs-primary ep:text-obs-muted ep:transition-transform ep:duration-150 ep:active:scale-95"
			aria-label="Undo last action"
			title="Undo last action"
			disabled={disabled}
			onClick={onUndo}
		>
			<div ref={iconRef} />
		</Clickable>
	);
}
