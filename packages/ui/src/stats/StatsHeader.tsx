import type { Signal } from "@preact/signals";
import type { StatsTimeRange } from "@true-recall/core";
import { Clickable } from "../shared/Clickable";
import { cn } from "../utils/cn";

const TIME_RANGES: { value: StatsTimeRange; label: string }[] = [
	{ value: "1m", label: "1M" },
	{ value: "3m", label: "3M" },
	{ value: "1y", label: "1Y" },
	{ value: "all", label: "All" },
];

interface StatsHeaderProps {
	timeRange: Signal<StatsTimeRange>;
}

export function StatsHeader({ timeRange }: StatsHeaderProps) {
	return (
		<div class="ep:flex ep:items-center ep:justify-between">
			<h2 class="ep:text-base ep:font-semibold ep:text-obs-normal">
				Statistics
			</h2>
			<div class="ep:flex ep:gap-1 ep:bg-obs-secondary ep:rounded-lg ep:p-0.5">
				{TIME_RANGES.map((range) => (
					<Clickable
						key={range.value}
						role="tab"
						aria-selected={timeRange.value === range.value}
						class={cn(
							"ep:px-3 ep:py-1 ep:text-xs ep:font-medium ep:rounded-md ep:transition-colors",
							timeRange.value === range.value
								? "ep:bg-obs-interactive/15 ep:text-obs-interactive"
								: "ep:text-obs-muted ep:hover:text-obs-normal",
						)}
						onClick={() => {
							timeRange.value = range.value;
						}}
					>
						{range.label}
					</Clickable>
				))}
			</div>
		</div>
	);
}
