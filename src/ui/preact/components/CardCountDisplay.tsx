export interface CardCountDisplayProps {
	newCount: number;
	learningCount: number;
	dueCount: number;
	totalCount?: number;
	variant?: "full" | "compact";
	size?: "smaller" | "small";
	bold?: boolean;
}

export function CardCountDisplay({
	newCount,
	learningCount,
	dueCount,
	totalCount,
	variant = "full",
	size = "smaller",
	bold = true,
}: CardCountDisplayProps) {
	const sizeClass = size === "small" ? "ep:text-ui-small" : "ep:text-ui-smaller";
	const fontClass = bold ? "ep:font-medium" : "";

	return (
		<span class={`ep:flex ep:items-center ep:gap-1 ${fontClass} ${sizeClass}`}>
			<span class="ep:text-obs-green">{newCount}</span>
			<span class="ep:text-obs-faint">&middot;</span>
			{variant === "full" && (
				<>
					<span class="ep:text-obs-orange">{learningCount}</span>
					<span class="ep:text-obs-faint">&middot;</span>
				</>
			)}
			<span class="ep:text-obs-blue">{dueCount}</span>
			{totalCount !== undefined && (
				<span class="ep:text-obs-faint"> ({totalCount})</span>
			)}
		</span>
	);
}
