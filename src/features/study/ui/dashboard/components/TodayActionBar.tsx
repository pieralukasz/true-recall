import { ActionButton } from "@shared/ui/components";
import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
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

	const reviewLabel =
		totalActionable > 0
			? `Review: ${totalActionable} (~${formatEstimatedTime(estimatedMinutes)})`
			: "All caught up!";

	const counts: { value: number; label: string; colorCls: string }[] = [];
	if (totalDue > 0)
		counts.push({
			value: totalDue,
			label: "due",
			colorCls: FSRS_COLORS.review.textCls,
		});
	if (totalNew > 0)
		counts.push({
			value: totalNew,
			label: "new",
			colorCls: FSRS_COLORS.new.textCls,
		});
	if (totalLearning > 0)
		counts.push({
			value: totalLearning,
			label: "lrn",
			colorCls: FSRS_COLORS.learning.textCls,
		});

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-primary ep:p-4">
			{/* Top row: count cards + button */}
			<div class="ep:flex ep:items-center ep:justify-between ep:gap-3">
				<div class="ep:flex ep:items-center ep:gap-2">
					{counts.map((c) => (
						<div
							key={c.label}
							class="ep:flex ep:flex-col ep:items-center ep:rounded-md ep:bg-obs-secondary/50 ep:px-3 ep:py-1.5"
						>
							<span class={`ep:text-lg ep:font-semibold ${c.colorCls}`}>
								{c.value}
							</span>
							<span class="ep:text-ui-smaller ep:text-obs-muted">
								{c.label}
							</span>
						</div>
					))}
					{totalActionable === 0 && (
						<span class="ep:text-sm ep:text-obs-muted">Nothing to review</span>
					)}
				</div>

				<ActionButton
					label={reviewLabel}
					variant="primary"
					onClick={handleStartReview}
					disabled={totalActionable === 0}
				/>
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
		</div>
	);
}
