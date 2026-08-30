import { Menu } from "obsidian";
import { useCallback } from "preact/hooks";

import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { usePolishPresetMenu } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePolishPresetMenu";
import { useSelectionActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useSelectionActions";
import { isSuspended } from "@true-recall/obsidian/features/library/ui/panel/utils/card-status.utils";

export function SelectionActionsBar() {
	const { selectedCardIds, cardsWithFsrs } = usePanelStore();
	const actions = useSelectionActions();
	const { hasPolishPresets, openPolishMenu } = usePolishPresetMenu();
	const selectedCards = cardsWithFsrs.filter((card) =>
		selectedCardIds.has(card.id),
	);
	const shouldUnsuspend =
		selectedCards.length > 0 &&
		selectedCards.every((card) => isSuspended(card));
	const hasSelection = selectedCardIds.size > 0;

	const openMoreMenu = useCallback(
		(event: MouseEvent) => {
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle("Change note type")
					.setIcon("replace")
					.setDisabled(!hasSelection)
					.onClick(() => void actions.handleChangeNoteType()),
			);
			menu.addItem((item) =>
				item
					.setTitle("Forget")
					.setIcon("rotate-ccw")
					.setDisabled(!hasSelection)
					.onClick(() => void actions.handleForgetSelected()),
			);
			if (hasPolishPresets) {
				menu.addItem((item) =>
					item
						.setTitle("Polish with AI")
						.setIcon("wand")
						.setDisabled(!hasSelection)
						.onClick(() => openPolishMenu(event)),
				);
			}
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle("Delete")
					.setIcon("trash-2")
					.setDisabled(!hasSelection)
					.onClick(() => void actions.handleDeleteSelected()),
			);
			menu.showAtMouseEvent(event);
		},
		[hasSelection, actions, hasPolishPresets, openPolishMenu],
	);

	return (
		<footer class="ep:flex ep:shrink-0 ep:items-center ep:gap-1.5 ep:border-t ep:border-obs-border ep:bg-obs-primary ep:p-2">
			<BulkButton
				label="Move"
				disabled={!hasSelection}
				onClick={() => void actions.handleMoveSelected()}
			/>
			<BulkButton
				label={shouldUnsuspend ? "Unsuspend" : "Suspend"}
				disabled={!hasSelection}
				onClick={() =>
					void (shouldUnsuspend
						? actions.handleUnsuspendSelected()
						: actions.handleSuspendSelected())
				}
			/>
			<button
				type="button"
				class="ep:ml-auto ep:rounded-md ep:border ep:border-obs-border ep:bg-transparent ep:px-2.5 ep:py-1.5 ep:text-ui-smaller ep:font-medium ep:text-obs-normal ep:cursor-pointer ep:touch-manipulation ep:hover:bg-obs-modifier-hover ep:disabled:opacity-50"
				disabled={!hasSelection}
				onClick={openMoreMenu}
			>
				More…
			</button>
		</footer>
	);
}

function BulkButton({
	label,
	disabled,
	onClick,
}: {
	label: string;
	disabled: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			class="ep:rounded-md ep:border ep:border-obs-border ep:bg-transparent ep:px-2.5 ep:py-1.5 ep:text-ui-smaller ep:font-medium ep:text-obs-normal ep:cursor-pointer ep:touch-manipulation ep:hover:bg-obs-modifier-hover ep:disabled:opacity-50 ep:disabled:cursor-not-allowed"
			disabled={disabled}
			onClick={onClick}
		>
			{label}
		</button>
	);
}
