import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";

interface RetentionDisplayProps {
	newCount: number;
	learningCount: number;
}

/**
 * Row-level R-Mode readout: what you chose to take in (new), what has a real
 * short deadline (learning), and nothing else.
 *
 * Three things were tried in this space and removed. Mean retrievability and
 * pool size do not discriminate — FSRS drives every deck toward the same
 * retention target, so both read almost identically on every row. A presence
 * marker duplicated the priority dot that already sits at the start of the row.
 * Whether anything is waiting is carried by that dot and by the row dimming;
 * the numbers stay for the two counts that are genuinely per-project.
 *
 * The full breakdown is on hover.
 */
export function RetentionDisplay({
	newCount,
	learningCount,
}: RetentionDisplayProps) {
	return (
		<span class="ep:flex ep:items-center ep:gap-2 ep:text-ui-smaller ep:font-medium ep:shrink-0 ep:tabular-nums">
			<span class="ep:w-8 ep:text-right" title="New cards">
				<span class={FSRS_COLORS.new.textCls}>{newCount}</span>
			</span>
			<span class="ep:w-6 ep:text-right" title="Learning cards">
				<span class={FSRS_COLORS.learning.textCls}>{learningCount}</span>
			</span>
		</span>
	);
}
