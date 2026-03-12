import type { StreakInfo, TodaySummary } from "@shared/types";
import { useIcon } from "@shared/ui/preact";

interface TodayHeroProps {
	today: TodaySummary;
	streak: StreakInfo;
	dueTomorrow: number;
	dailyLoad: number;
	totalCards: number;
}

export function TodayHero({
	today,
	streak,
	dueTomorrow,
	totalCards,
}: TodayHeroProps) {
	return (
		<div class="ep:grid ep:grid-cols-2 sm:ep:grid-cols-3 lg:ep:grid-cols-6 ep:gap-2">
			<StatCard label="Studied today" value={today.studied} icon="book-open" />
			<StatCard label="Minutes" value={today.minutes} icon="clock" />
			<StatCard
				label="Correct"
				value={`${Math.round(today.correctRate * 100)}%`}
				icon="check-circle"
				color={
					today.correctRate >= 0.8
						? "green"
						: today.correctRate >= 0.6
							? "orange"
							: "red"
				}
			/>
			<StatCard
				label="Current streak"
				value={`${streak.current}d`}
				icon="flame"
				color="orange"
			/>
			<StatCard label="Due tomorrow" value={dueTomorrow} icon="calendar" />
			<StatCard label="Total cards" value={totalCards} icon="layers" />
		</div>
	);
}

function StatCard({
	label,
	value,
	icon,
	color,
}: {
	label: string;
	value: string | number;
	icon: string;
	color?: "green" | "orange" | "red";
}) {
	const iconRef = useIcon(icon);
	const colorCls =
		color === "green"
			? "ep:text-obs-green"
			: color === "orange"
				? "ep:text-obs-orange"
				: color === "red"
					? "ep:text-obs-error"
					: "ep:text-obs-interactive";

	return (
		<div class="ep:rounded-lg ep:border ep:border-obs-modifier-border ep:bg-obs-primary ep:p-3 ep:flex ep:flex-col ep:gap-1">
			<div class="ep:flex ep:items-center ep:gap-1.5 ep:text-obs-muted">
				<span ref={iconRef} class="[&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5" />
				<span class="ep:text-xs">{label}</span>
			</div>
			<span class={`ep:text-xl ep:font-bold ${colorCls}`}>{value}</span>
		</div>
	);
}
