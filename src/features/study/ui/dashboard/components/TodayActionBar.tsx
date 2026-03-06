import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
import { ActionButton } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { formatEstimatedTime } from "../helpers/time-estimate";
import type { TodayProgress } from "../types";

interface TodayActionBarProps {
	totalDue: number;
	totalNew: number;
	totalLearning: number;
	estimatedMinutes: number;
	progress: TodayProgress;
}

export function TodayActionBar({
	totalDue,
	totalNew,
	totalLearning,
	estimatedMinutes,
	progress,
}: TodayActionBarProps) {
	const plugin = usePlugin();

	const totalActionable = totalDue + totalNew + totalLearning;

	const handleStartReview = () => {
		void plugin.openReviewViewWithFilters({ deckFilter: null });
	};

	const { studied, minutes, newCards, newCardsCap, reviewCards, reviewsCap } =
		progress;
	const totalCap = newCardsCap + reviewsCap;
	const newPct = totalCap > 0 ? Math.min(newCards / totalCap, 1) : 0;
	const reviewPct = totalCap > 0 ? Math.min(reviewCards / totalCap, 1) : 0;
	const progressPct = totalCap > 0 ? Math.min(studied / totalCap, 1) : 0;

	const primaryLabel =
		totalActionable > 0
			? `Start Review: ${totalActionable} cards (~${formatEstimatedTime(estimatedMinutes)})`
			: "All caught up!";

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-primary ep:p-4">
			{/* Counts */}
			<div class="ep:flex ep:items-center ep:gap-4 ep:text-sm ep:font-medium">
				{totalDue > 0 && (
					<span class={FSRS_COLORS.review.textCls}>
						{totalDue} due
					</span>
				)}
				{totalNew > 0 && (
					<span class={FSRS_COLORS.new.textCls}>
						{totalNew} new
					</span>
				)}
				{totalLearning > 0 && (
					<span class={FSRS_COLORS.learning.textCls}>
						{totalLearning} lrn
					</span>
				)}
				{totalActionable === 0 && (
					<span class="ep:text-obs-muted">Nothing to review</span>
				)}
			</div>

			{/* Progress bar */}
			<div class="ep:flex ep:flex-col ep:gap-1.5">
				<div class="ep:h-1.5 ep:rounded-full ep:bg-obs-secondary ep:overflow-hidden ep:flex">
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
				{studied > 0 && (
					<span class="ep:text-ui-smaller ep:text-obs-muted">
						{studied} studied{minutes > 0 && ` · ${minutes} min`}
					</span>
				)}
			</div>

			{/* Start Review */}
			<ActionButton
				label={primaryLabel}
				variant="primary"
				onClick={handleStartReview}
				fullWidth
				disabled={totalActionable === 0}
			/>
		</div>
	);
}
