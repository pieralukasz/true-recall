import type { CollectionHealthSnapshot } from "@shared/types";
import { getThemeColor } from "../helpers/chart-theme";
import { ChartCard } from "./ChartCard";

interface CollectionHealthBarProps {
	data: CollectionHealthSnapshot;
}

export function CollectionHealthBar({ data }: CollectionHealthBarProps) {
	if (data.cardCount === 0) {
		return (
			<ChartCard title="Collection Health">
				<p class="ep:text-xs ep:text-obs-muted ep:py-4 ep:text-center">
					No active cards
				</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard
			title="Collection Health"
			subtitle={`Average retention: ${data.averageRetention}% across ${data.cardCount} cards`}
		>
			<div class="ep:flex ep:h-6 ep:rounded-md ep:overflow-hidden ep:border ep:border-obs-modifier-border">
				{data.distribution.map((bucket) => {
					const width =
						data.cardCount > 0 ? (bucket.count / data.cardCount) * 100 : 0;
					if (width === 0) return null;
					return (
						<div
							key={bucket.label}
							title={`${bucket.label}: ${bucket.count} cards (${Math.round(width)}%)`}
							style={{
								width: `${width}%`,
								backgroundColor: getThemeColor(bucket.colorVar),
								minWidth: bucket.count > 0 ? "2px" : "0",
							}}
						/>
					);
				})}
			</div>
			<div class="ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1 ep:mt-2 ep:text-xs ep:text-obs-muted">
				{data.distribution.map((bucket) => (
					<div key={bucket.label} class="ep:flex ep:items-center ep:gap-1.5">
						<div
							class="ep:w-2.5 ep:h-2.5 ep:rounded-sm"
							style={{ backgroundColor: getThemeColor(bucket.colorVar) }}
						/>
						<span>
							{bucket.label}: {bucket.count}
						</span>
					</div>
				))}
			</div>
		</ChartCard>
	);
}
