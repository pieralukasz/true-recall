import type { StatsTimeRange } from "@shared/types";

export function formatDateLabel(isoDate: string): string {
	const date = new Date(isoDate);
	return `${date.getDate()}/${date.getMonth() + 1}`;
}

export function formatDateForDisplay(isoDate: string): string {
	const date = new Date(isoDate);
	return date.toLocaleDateString(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function getMaxTicksForRange(range: StatsTimeRange): number {
	switch (range) {
		case "1y":
			return 12;
		case "3m":
			return 13;
		case "1m":
			return 15;
		default:
			return 30;
	}
}

export function getHeatmapLevelClasses(count: number): string {
	if (count === 0) return "ep:!bg-obs-modifier-border";
	if (count < 10) return "ep:!bg-[rgba(var(--obs-green-rgb),0.2)]";
	if (count < 25) return "ep:!bg-[rgba(var(--obs-green-rgb),0.4)]";
	if (count < 50) return "ep:!bg-[rgba(var(--obs-green-rgb),0.6)]";
	return "ep:!bg-[rgba(var(--obs-green-rgb),0.9)]";
}
