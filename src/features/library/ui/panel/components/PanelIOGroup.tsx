import { IOCardRenderer } from "@features/image-occlusion/IOCardRenderer";
import { parseIODefinition } from "@features/image-occlusion/io-definition";
import type { FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { Clickable } from "@shared/ui/components/Clickable";
import { IconButton } from "@shared/ui/components/IconButton";
import {
	type MenuItem,
	useContextMenu,
} from "@shared/ui/preact/useContextMenu";
import { useCallback, useMemo, useState } from "preact/hooks";

export interface PanelIOGroupProps {
	cards: FlashcardItem[];
	fsrsCards: FSRSFlashcardItem[];
	filePath: string;
	isExpanded: boolean;
	isSelected: boolean;
	isSelectionMode: boolean;
	onToggleExpand: () => void;
	onToggleSelect: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onMove: () => void;
	onSelect: () => void;
}

export function PanelIOGroup({
	cards,
	fsrsCards,
	filePath,
	isExpanded,
	isSelected,
	isSelectionMode,
	onToggleExpand,
	onToggleSelect,
	onEdit,
	onDelete,
	onMove,
	onSelect,
}: PanelIOGroupProps) {
	const [revealedOrd, setRevealedOrd] = useState<number | null>(null);

	const representative = fsrsCards[0];
	const imagePath = representative?.ioImagePath;
	const regionsJson = representative?.ioRegionsJson;

	const regionLabels = useMemo(() => {
		if (!regionsJson) return [];
		const def = parseIODefinition(regionsJson);
		if (!def) return [];
		const labelMap = new Map<number, string>();
		for (const [i, r] of def.regions.entries()) {
			const ord = Number.parseInt(r.groupKey, 10);
			const key = Number.isFinite(ord) && ord >= 0 ? ord : i;
			if (!labelMap.has(key)) {
				labelMap.set(key, r.label ?? `Region ${key + 1}`);
			}
		}
		return [...labelMap.entries()].sort((a, b) => a[0] - b[0]);
	}, [regionsJson]);

	const handleClick = useCallback(
		(e: MouseEvent) => {
			if ((e.target as HTMLElement).closest("button")) return;
			if (isSelectionMode) {
				onToggleSelect();
			} else {
				onToggleExpand();
			}
		},
		[isSelectionMode, onToggleSelect, onToggleExpand],
	);

	const handleRegionClick = useCallback((ord: number) => {
		setRevealedOrd((prev) => (prev === ord ? null : ord));
	}, []);

	const handleCheckboxClick = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation();
			onToggleSelect();
		},
		[onToggleSelect],
	);

	const handleMenuClick = useContextMenu([
		{ title: "Edit", icon: "pencil", onClick: onEdit },
		{ title: "Move", icon: "folder-input", onClick: onMove },
		"separator",
		{ title: "Delete all", icon: "trash-2", onClick: onDelete },
		...(!isSelectionMode
			? ([
					"separator",
					{ title: "Select", icon: "check-square", onClick: onSelect },
				] as MenuItem[])
			: []),
	]);

	const selectedCls = isSelected ? "ep:border-obs-interactive" : "";

	return (
		<Clickable
			class={`ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border-[1px] ep:border-obs-border/20 ep:shadow-sm ep:hover:bg-obs-modifier-hover ep:transition-colors ep:duration-300 ${selectedCls}`}
			onClick={handleClick}
		>
			<div class="ep:flex ep:items-center ep:gap-2 ep:p-3 ep:text-left ep:w-full">
				{isSelectionMode && (
					<input
						type="checkbox"
						class="ep:w-4 ep:h-4 ep:cursor-pointer"
						checked={isSelected}
						onClick={handleCheckboxClick}
					/>
				)}

				<div class="ep:flex-1 ep:overflow-hidden ep:rounded">
					<IOCardRenderer
						imagePath={imagePath}
						regionsJson={regionsJson}
						templateOrd={revealedOrd ?? -1}
						revealed={revealedOrd !== null}
						maskModeOverride="all"
						onRegionClick={handleRegionClick}
					/>
				</div>

				<IconButton
					icon="more-vertical"
					ariaLabel="Group actions"
					onClick={handleMenuClick}
					size="small"
					class="ep:opacity-30 ep:hover:opacity-100 ep:transition-opacity"
				/>
			</div>

			{isExpanded && (
				<div class="ep:px-3 ep:pb-3 ep:pt-2 ep:border-t ep:border-obs-border">
					<div class="ep:flex ep:flex-wrap ep:gap-1.5">
						{regionLabels.map(([ord, label]) => (
							<Clickable
								key={ord}
								class={`ep:text-ui-smaller ep:px-2 ep:py-1 ep:rounded-md ep:border ep:transition-colors ${
									revealedOrd === ord
										? "ep:border-obs-green/50 ep:bg-obs-green/10 ep:text-obs-green"
										: "ep:border-obs-border ep:text-obs-muted ep:hover:border-obs-accent/30"
								}`}
								onClick={() => handleRegionClick(ord)}
							>
								{label}
							</Clickable>
						))}
					</div>
				</div>
			)}
		</Clickable>
	);
}
