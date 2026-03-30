import { usePanelStore } from "@features/library/ui/panel/hooks/usePanelStore";
import {
	type UseSelectionActionsParams,
	useSelectionActions,
} from "@features/library/ui/panel/hooks/useSelectionActions";
import { IconButton } from "@shared/ui/components";

export type SelectionToolbarProps = Pick<
	UseSelectionActionsParams,
	"preserveScroll"
>;

export function SelectionToolbar({ preserveScroll }: SelectionToolbarProps) {
	const { selectedCardIds, flashcardInfo } = usePanelStore();
	const {
		handleExitSelectionMode,
		handleSelectAll,
		handleMoveSelected,
		handleChangeNoteType,
		handleSuspendSelected,
		handleUnsuspendSelected,
		handleForgetSelected,
		handleDeleteSelected,
	} = useSelectionActions({ preserveScroll });

	const selectedCount = selectedCardIds.size;
	const totalCount = flashcardInfo?.flashcards.length ?? 0;
	const allSelected = selectedCount === totalCount && totalCount > 0;
	const hasSelection = selectedCount > 0;

	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<div class="ep:flex ep:items-center ep:justify-between">
				<div class="ep:flex ep:items-center ep:gap-2">
					<IconButton
						icon="x"
						ariaLabel="Exit selection mode"
						onClick={handleExitSelectionMode}
						size="small"
					/>
					<span class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
						{selectedCount} selected
					</span>
				</div>
				<div class="ep:flex ep:items-center ep:gap-1">
					{!allSelected && (
						<IconButton
							icon="check-square"
							ariaLabel="Select all"
							onClick={handleSelectAll}
							size="small"
						/>
					)}
					<IconButton
						icon="folder-input"
						ariaLabel="Move selected"
						onClick={() => void handleMoveSelected()}
						size="small"
						disabled={!hasSelection}
					/>
					<IconButton
						icon="replace"
						ariaLabel="Change note type"
						onClick={() => void handleChangeNoteType()}
						size="small"
						disabled={!hasSelection}
					/>
					<IconButton
						icon="pause"
						ariaLabel="Suspend selected"
						onClick={() => void handleSuspendSelected()}
						size="small"
						disabled={!hasSelection}
					/>
					<IconButton
						icon="play"
						ariaLabel="Unsuspend selected"
						onClick={() => void handleUnsuspendSelected()}
						size="small"
						disabled={!hasSelection}
					/>
					<IconButton
						icon="rotate-ccw"
						ariaLabel="Forget selected"
						onClick={() => void handleForgetSelected()}
						size="small"
						disabled={!hasSelection}
					/>
					<IconButton
						icon="trash-2"
						ariaLabel="Delete selected"
						onClick={() => void handleDeleteSelected()}
						size="small"
						danger
						disabled={!hasSelection}
					/>
				</div>
			</div>
		</div>
	);
}
