import type { CollectionHealthSnapshot } from "@true-recall/core";
import { ChartCard } from "./ChartCard";
import { getThemeColor } from "../helpers/chart-theme";

interface CollectionHealthBarProps {
	data: CollectionHealthSnapshot;
}

export function CollectionHealthBar({ data }: CollectionHealthBarProps) {
	if (data.cardCount === 0) {
		return (
			<ChartCard
				title="Collection Health"
				subtitle="Predicted retention distribution"
			>
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">
					No cards yet
				</p>
			</ChartCard>
		);
	}

	const segments = data.distribution.map((bucket) => ({
		pct: Math.round((bucket.count / data.cardCount) * 100),
		color: getThemeColor(bucket.colorVar),
		label: `${bucket.label}: ${bucket.count}`,
	}));

	return (
		<ChartCard
			title="Collection Health"
			subtitle={`${data.cardCount} cards \u00B7 ${Math.round(data.averageRetention)}% avg retention`}
		>
			{/* Stacked bar */}
			<div class="ep:h-3 ep:rounded-full ep:overflow-hidden ep:flex ep:mb-3">
				{segments
					.filter((s) => s.pct > 0)
					.map((s) => (
						<div
							key={s.label}
							style={{ width: `${s.pct}%`, backgroundColor: s.color }}
							title={s.label}
						/>
					))}
			</div>
			{/* Legend */}
			<div class="ep:flex ep:flex-wrap ep:gap-3 ep:text-xs ep:text-obs-muted">
				{segments
					.filter((s) => s.pct > 0)
					.map((s) => (
						<span key={s.label} class="ep:flex ep:items-center ep:gap-1">
							<span
								class="ep:inline-block ep:w-2 ep:h-2 ep:rounded-sm"
								style={{ backgroundColor: s.color }}
							/>
							{s.label}
						</span>
					))}
			</div>
		</ChartCard>
	);
}
