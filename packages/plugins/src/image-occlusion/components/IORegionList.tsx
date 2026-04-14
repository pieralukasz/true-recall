import { Clickable } from "@true-recall/obsidian/components";

import type { IORegion } from "../types";
import { IconToolButton } from "./IOIconToolButton";

interface RegionListItemProps {
	region: IORegion;
	selected: boolean;
	onSelect: () => void;
	onDelete: () => void;
}

function RegionListItem({
	region,
	selected,
	onSelect,
	onDelete,
}: RegionListItemProps) {
	return (
		<div class={`true-recall-io-region-item ${selected ? "is-selected" : ""}`}>
			<Clickable
				class="true-recall-io-region-main"
				onClick={() => onSelect()}
				title={`Select region #${region.groupKey}`}
			>
				<span>#{region.groupKey}</span>
				<span>{region.shape}</span>
			</Clickable>
			{selected && (
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
	onSelectRegion: (id: string) => void;
	onDeleteSelected: () => void;
}

export function IORegionList({
	regions,
	selectedRegionId,
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
						selected={selectedRegionId === region.id}
						onSelect={() => onSelectRegion(region.id)}
						onDelete={onDeleteSelected}
					/>
				))}
			</div>
		</div>
	);
}
