import { Menu } from "obsidian";
import { useCallback } from "preact/hooks";

import { PanelIconButton } from "@true-recall/obsidian/features/library/ui/panel/components/PanelIconButton";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { useSelectionActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useSelectionActions";

interface SelectionProps {
	visibleCardIds: string[];
	allCardIds: string[];
}

export function SelectionToolbar({
	visibleCardIds,
	allCardIds,
}: SelectionProps) {
	const { selectedCardIds } = usePanelStore();
	const { handleExitSelectionMode, handleSelectCards } = useSelectionActions();

	const openSelectMenu = useCallback(
		(event: MouseEvent) => {
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle(`Select ${visibleCardIds.length} Visible`)
					.setIcon("list-checks")
					.setDisabled(visibleCardIds.length === 0)
					.onClick(() => handleSelectCards(visibleCardIds)),
			);
			if (visibleCardIds.length !== allCardIds.length) {
				menu.addItem((item) =>
					item
						.setTitle(`Select All ${allCardIds.length} Cards`)
						.setIcon("check-check")
						.setDisabled(allCardIds.length === 0)
						.onClick(() => handleSelectCards(allCardIds)),
				);
			}
			menu.showAtMouseEvent(event);
		},
		[visibleCardIds, allCardIds, handleSelectCards],
	);

	return (
		<header class="ep:flex ep:h-10 ep:shrink-0 ep:items-center ep:gap-2 ep:border-b ep:border-obs-border ep:px-2">
			<PanelIconButton
				icon="x"
				label="Exit Selection (Esc)"
				onClick={handleExitSelectionMode}
			/>
			<div class="ep:min-w-0 ep:flex-1 ep:text-ui-small ep:font-semibold ep:text-obs-normal">
				<span class="ep:tabular-nums">{selectedCardIds.size}</span> Selected
			</div>
			<PanelIconButton
				icon="list-checks"
				label="Select Visible or All Cards"
				onClick={openSelectMenu}
			/>
		</header>
	);
}
