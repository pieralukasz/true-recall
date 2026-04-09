import { cva } from "class-variance-authority";

import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";

export interface CardCountDisplayProps {
	newCount: number;
	learningCount: number;
	dueCount: number;
	totalCount?: number;
	variant?: "full" | "compact";
	size?: "smaller" | "small";
	bold?: boolean;
}

const cardCountVariants = cva("ep:flex ep:items-center ep:gap-1", {
	variants: {
		size: {
			smaller: "ep:text-ui-smaller",
			small: "ep:text-ui-small",
		},
		bold: {
			true: "ep:font-medium",
		},
	},
	defaultVariants: { size: "smaller", bold: true },
});

export function CardCountDisplay({
	newCount,
	learningCount,
	dueCount,
	totalCount,
	variant = "full",
	size = "smaller",
	bold = true,
}: CardCountDisplayProps) {
	return (
		<span class={cardCountVariants({ size, bold })}>
			<span class={FSRS_COLORS.new.textCls}>{newCount}</span>
			<span class="ep:text-obs-faint">&middot;</span>
			{variant === "full" && (
				<>
					<span class={FSRS_COLORS.learning.textCls}>{learningCount}</span>
					<span class="ep:text-obs-faint">&middot;</span>
				</>
			)}
			<span class={FSRS_COLORS.review.textCls}>{dueCount}</span>
			{totalCount !== undefined && (
				<span class="ep:text-obs-faint"> ({totalCount})</span>
			)}
		</span>
	);
}
