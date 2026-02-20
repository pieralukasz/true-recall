import {
	ActionButton,
	IconButton,
} from "@shared/ui/components";

export interface SelectionBarProps {
	selectedCount: number;
	onCancel: () => void;
	onSuspend: () => void;
	onUnsuspend: () => void;
	onReset: () => void;
	onDelete: () => void;
}

export function SelectionBar({
	selectedCount,
	onCancel,
	onSuspend,
	onUnsuspend,
	onReset,
	onDelete,
}: SelectionBarProps) {
	const disabled = selectedCount === 0;

	return (
		<div class="ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-t ep:border-obs-border ep:bg-obs-secondary">
			<div class="ep:flex ep:items-center ep:gap-2">
				<IconButton icon="x" ariaLabel="Cancel selection" onClick={onCancel} />
				<span class="ep:text-ui-small ep:text-obs-normal ep:font-medium">
					Selected: {selectedCount}
				</span>
			</div>
			<div class="ep:flex ep:items-center ep:gap-2">
				<ActionButton
					label="Suspend"
					icon="pause"
					variant="secondary"
					disabled={disabled}
					onClick={onSuspend}
				/>
				<ActionButton
					label="Unsuspend"
					icon="play"
					variant="secondary"
					disabled={disabled}
					onClick={onUnsuspend}
				/>
				<ActionButton
					label="Reset"
					icon="rotate-ccw"
					variant="secondary"
					disabled={disabled}
					onClick={onReset}
				/>
				<ActionButton
					label="Delete"
					icon="trash-2"
					variant="danger"
					disabled={disabled}
					onClick={onDelete}
				/>
			</div>
		</div>
	);
}
