import { IconToolButton } from "@features/image-occlusion/IOIconToolButton";
import type { IORegion } from "@features/image-occlusion/types";
import { Clickable } from "@shared/ui/components/Clickable";

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

export interface IORegionListProps {
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
					<div class="ep:text-ui-smaller ep:text-obs-muted">
						No regions yet
					</div>
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
