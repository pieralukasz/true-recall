import type { SelectionMode } from "@shared/store";
import { ActionButton } from "@shared/ui/components";

export interface PanelFooterProps {
	selectionMode: SelectionMode;
	selectedCount: number;
	totalCount: number;
	onSelectAll: () => void;
	onMoveSelected: () => void;
	onDeleteSelected: () => void;
}

export function PanelFooter({
	selectionMode,
	selectedCount,
	totalCount,
	onSelectAll,
	onMoveSelected,
	onDeleteSelected,
}: PanelFooterProps) {
	if (selectionMode !== "selecting") return null;

	const allSelected = selectedCount === totalCount && totalCount > 0;

	return (
		<div class="ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-t ep:border-obs-border ep:bg-obs-secondary">
			<div class="ep:flex ep:items-center ep:gap-2">
				<span class="ep:text-ui-small ep:text-obs-normal ep:font-medium">
					Selected: {selectedCount}
				</span>
				{!allSelected && (
					<ActionButton
						label="Select all"
						icon="check-square"
						variant="secondary"
						onClick={onSelectAll}
					/>
				)}
			</div>
			<div class="ep:flex ep:items-center ep:gap-2">
				<ActionButton
					label="Move"
					icon="folder-input"
					variant="secondary"
					disabled={selectedCount === 0}
					onClick={onMoveSelected}
				/>
				<ActionButton
					label="Delete"
					icon="trash-2"
					variant="danger"
					disabled={selectedCount === 0}
					onClick={onDeleteSelected}
				/>
			</div>
		</div>
	);
}
