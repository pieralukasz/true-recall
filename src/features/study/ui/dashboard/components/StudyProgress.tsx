import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
import type { TodayProgress } from "../types";

interface StudyProgressProps {
	progress: TodayProgress;
}

export function StudyProgress({ progress }: StudyProgressProps) {
	const {
		studied,
		minutes,
		newCards,
		newCardsCap,
		reviewCards,
		reviewsCap,
	} = progress;

	const totalCap = newCardsCap + reviewsCap;
	const progressPct = totalCap > 0 ? Math.min(studied / totalCap, 1) : 0;
	const newPct = totalCap > 0 ? Math.min(newCards / totalCap, 1) : 0;
	const reviewPct =
		totalCap > 0 ? Math.min(reviewCards / totalCap, 1) : 0;

	if (studied === 0) {
		return (
			<div class="ep:flex ep:flex-col ep:gap-2">
				<div class="ep:h-2 ep:rounded-full ep:bg-obs-secondary ep:overflow-hidden" />
				<span class="ep:text-ui-smaller ep:text-obs-faint">
					No cards studied yet today
				</span>
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<div
				class="ep:h-2 ep:rounded-full ep:bg-obs-secondary ep:overflow-hidden ep:flex"
				role="progressbar"
				aria-valuenow={studied}
				aria-valuemax={totalCap}
			>
				{newPct > 0 && (
					<div
						class="ep:h-full ep:transition-all ep:duration-300"
						style={{
							width: `${newPct * 100}%`,
							backgroundColor: `var(${FSRS_COLORS.new.cssVar})`,
						}}
					/>
				)}
				{reviewPct > 0 && (
					<div
						class="ep:h-full ep:transition-all ep:duration-300"
						style={{
							width: `${reviewPct * 100}%`,
							backgroundColor: `var(${FSRS_COLORS.review.cssVar})`,
						}}
					/>
				)}
				{progressPct > newPct + reviewPct && (
					<div
						class="ep:h-full ep:transition-all ep:duration-300"
						style={{
							width: `${(progressPct - newPct - reviewPct) * 100}%`,
							backgroundColor: `var(${FSRS_COLORS.learning.cssVar})`,
						}}
					/>
				)}
			</div>

			<div class="ep:flex ep:items-center ep:justify-between ep:text-ui-smaller ep:text-obs-muted">
				<span>
					{studied} studied
					{minutes > 0 && ` \u00B7 ${minutes} min`}
				</span>
				<span>
					<span class={FSRS_COLORS.new.textCls}>
						{newCards}/{newCardsCap}
					</span>
					{" new \u00B7 "}
					<span class={FSRS_COLORS.review.textCls}>
						{reviewCards}/{reviewsCap}
					</span>
					{" reviews"}
				</span>
			</div>
		</div>
	);
}
