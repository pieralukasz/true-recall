import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";

export interface DashboardStats {
	due: number;
	newCount: number;
	learning: number;
	streak: number;
}

export function DashboardStatCards({ stats }: { stats: DashboardStats }) {
	const cards = [
		{
			label: "Due",
			value: stats.due,
			color: `var(${FSRS_COLORS.review.cssVar})`,
		},
		{
			label: "New",
			value: stats.newCount,
			color: `var(${FSRS_COLORS.new.cssVar})`,
		},
		{
			label: "Learning",
			value: stats.learning,
			color: `var(${FSRS_COLORS.learning.cssVar})`,
		},
		{
			label: "Streak",
			value: stats.streak,
			suffix: "d",
			color: undefined,
		},
	];

	return (
		<div class="ep:flex-1 ep:grid ep:grid-cols-4 ep:gap-3">
			{cards.map((c) => (
				<div
					key={c.label}
					class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:p-4 ep:rounded-lg ep:bg-obs-secondary ep:transition-all ep:duration-200"
				>
					<span
						class="ep:text-3xl ep:font-semibold ep:mb-1 ep:font-interface"
						style={c.color ? { color: c.color } : undefined}
					>
						{c.value}
						{c.suffix ?? ""}
					</span>
					<span class="ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:uppercase ep:tracking-wider">
						{c.label}
					</span>
				</div>
			))}
		</div>
	);
}
