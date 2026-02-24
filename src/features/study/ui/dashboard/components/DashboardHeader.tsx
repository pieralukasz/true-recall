import { useIcon } from "@shared/ui/preact/hooks";
import { formatEstimatedTime } from "../helpers/time-estimate";

interface DashboardHeaderProps {
	totalDue: number;
	totalNew: number;
	noteCount: number;
	estimatedMinutes: number;
	streak: number;
}

export function DashboardHeader({
	totalDue,
	totalNew,
	noteCount,
	estimatedMinutes,
	streak,
}: DashboardHeaderProps) {
	const streakIconRef = useIcon(streak > 0 ? "flame" : "calendar-check");

	const totalActive = totalDue + totalNew;
	const contextParts: string[] = [];
	if (totalActive > 0)
		contextParts.push(
			`${totalActive} card${totalActive !== 1 ? "s" : ""} across ${noteCount} note${noteCount !== 1 ? "s" : ""}`,
		);
	if (estimatedMinutes > 0)
		contextParts.push(`~${formatEstimatedTime(estimatedMinutes)}`);

	return (
		<div class="ep:flex ep:items-start ep:justify-between ep:gap-4">
			<div class="ep:flex ep:flex-col ep:gap-0.5">
				<h2 class="ep:text-ui-large ep:font-semibold ep:text-obs-normal ep:m-0 ep:p-0">
					Today
				</h2>
				{contextParts.length > 0 && (
					<span class="ep:text-ui-small ep:text-obs-muted">
						{contextParts.join(" \u00B7 ")}
					</span>
				)}
			</div>

			{streak > 0 && (
				<div class="ep:flex ep:items-center ep:gap-1.5 ep:px-2.5 ep:py-1 ep:rounded-full ep:bg-obs-secondary ep:text-obs-muted ep:shrink-0">
					<span
						ref={streakIconRef}
						class="[&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5"
					/>
					<span class="ep:text-ui-smaller ep:font-medium">
						{streak}d
					</span>
				</div>
			)}
		</div>
	);
}
