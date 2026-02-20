import type { StatsTimeRange } from "../../../../../shared/types";

const TIME_RANGES: { label: string; value: StatsTimeRange }[] = [
	{ label: "Backlog", value: "backlog" },
	{ label: "1 Month", value: "1m" },
	{ label: "3 Months", value: "3m" },
	{ label: "1 Year", value: "1y" },
	{ label: "All", value: "all" },
];

export function TimeRangeSelector({
	currentRange,
	onRangeChange,
}: {
	currentRange: StatsTimeRange;
	onRangeChange: (range: StatsTimeRange) => void;
}) {
	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:mb-5 ep:flex-wrap">
			{TIME_RANGES.map(({ label, value }) => {
				const isActive = value === currentRange;
				return (
					<button
						type="button"
						key={value}
						class={[
							"ep:py-2 ep:px-4 ep:rounded-lg ep:text-ui-small ep:font-medium ep:transition-all ep:duration-200 ep:cursor-pointer",
							isActive
								? "ep:bg-obs-interactive ep:text-obs-on-accent"
								: "ep:bg-obs-secondary ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:hover:-translate-y-px",
						].join(" ")}
						onClick={() => {
							if (value !== currentRange) onRangeChange(value);
						}}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
}
