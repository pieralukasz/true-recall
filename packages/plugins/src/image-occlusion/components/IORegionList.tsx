import { Clickable } from "@true-recall/obsidian/components";

import type { IORegion } from "../types";
import { IconToolButton } from "./IOIconToolButton";

interface RegionListItemProps {
	region: IORegion;
	selected: boolean;
	showDelete: boolean;
	onSelect: (additive: boolean) => void;
	onDelete: () => void;
}

function RegionListItem({
	region,
	selected,
	showDelete,
	onSelect,
	onDelete,
}: RegionListItemProps) {
	return (
		<div class={`true-recall-io-region-item ${selected ? "is-selected" : ""}`}>
			<Clickable
				class="true-recall-io-region-main"
				onClick={(event: MouseEvent | KeyboardEvent) =>
					onSelect(event.shiftKey || event.metaKey || event.ctrlKey)
				}
				title={`Select region #${region.groupKey} (Shift or Cmd/Ctrl-click to select several)`}
			>
				<span>#{region.groupKey}</span>
				<span>{region.shape}</span>
			</Clickable>
			{showDelete && (
				<IconToolButton
					icon="trash-2"
					label={`Delete region #${region.groupKey}`}
					shortcut="Delete"
					danger
					onClick={onDelete}
				/>
			)}
		</div>
	);
}

interface IORegionListProps {
	regions: IORegion[];
	selectedRegionId: string | null;
	selectedRegionIds?: readonly string[];
	onSelectRegion: (id: string, additive?: boolean) => void;
	onDeleteSelected: () => void;
}

export function IORegionList({
	regions,
	selectedRegionId,
	selectedRegionIds,
	onSelectRegion,
	onDeleteSelected,
}: IORegionListProps) {
	return (
		<div class="true-recall-io-side-section">
			<div class="ep:text-ui-small ep:font-medium ep:mb-1">
				Regions ({regions.length})
			</div>
			<div class="true-recall-io-region-list">
				{regions.length === 0 && (
					<div class="ep:text-ui-smaller ep:text-obs-muted">No regions yet</div>
				)}
				{regions.map((region) => (
					<RegionListItem
						key={region.id}
						region={region}
						selected={
							selectedRegionId === region.id ||
							(selectedRegionIds?.includes(region.id) ?? false)
						}
						showDelete={selectedRegionId === region.id}
						onSelect={(additive) => onSelectRegion(region.id, additive)}
						onDelete={onDeleteSelected}
					/>
				))}
			</div>
		</div>
	);
}
