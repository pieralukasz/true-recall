import type { StatsTimeRange } from "@shared/types";
import { Clickable } from "@shared/ui/components";
import { cva } from "class-variance-authority";

const TIME_RANGES: { label: string; value: StatsTimeRange }[] = [
	{ label: "Backlog", value: "backlog" },
	{ label: "1 Month", value: "1m" },
	{ label: "3 Months", value: "3m" },
	{ label: "1 Year", value: "1y" },
	{ label: "All", value: "all" },
];

const timeRangeButtonVariants = cva(
	"ep:py-2 ep:px-4 ep:rounded-lg ep:text-ui-small ep:font-medium ep:transition-colors ep:duration-200",
	{
		variants: {
			active: {
				true: "ep:bg-obs-interactive ep:text-obs-on-accent",
				false:
					"ep:bg-obs-secondary ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
			},
		},
		defaultVariants: { active: false },
	},
);

export function TimeRangeSelector({
	currentRange,
	onRangeChange,
}: {
	currentRange: StatsTimeRange;
	onRangeChange: (range: StatsTimeRange) => void;
}) {
	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:flex-wrap">
			{TIME_RANGES.map(({ label, value }) => (
				<Clickable
					key={value}
					class={timeRangeButtonVariants({ active: value === currentRange })}
					onClick={() => {
						if (value !== currentRange) onRangeChange(value);
					}}
				>
					{label}
				</Clickable>
			))}
		</div>
	);
}
