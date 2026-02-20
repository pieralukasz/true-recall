import type { ReviewApi } from "@shared/store";

const BADGE_COLORS: Record<string, string> = {
	new: "ep:bg-obs-green/20 ep:text-obs-green",
	learning: "ep:bg-obs-orange/20 ep:text-obs-orange",
	due: "ep:bg-obs-blue/20 ep:text-obs-blue",
};

function ReviewStatBadge({ type, count }: { type: string; count: number }) {
	return (
		<div
			class={`ep:flex ep:items-center ep:justify-center ep:min-w-5 ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold ${BADGE_COLORS[type]}`}
		>
			<span>{count}</span>
		</div>
	);
}

export function ReviewHeader({
	review,
	showStats,
	crammingMode,
}: {
	review: ReviewApi;
	showStats: boolean;
	crammingMode: boolean;
}) {
	if (!showStats) return null;

	const counts = review.getBadgeCounts();

	return (
		<div class="ep:flex ep:justify-center ep:items-center ep:border-b ep:border-obs-border ep:relative ep:shrink-0 ep:p-2 ep:pb-4">
			<div class="ep:flex ep:items-center ep:gap-1.5">
				<ReviewStatBadge type="new" count={counts.new} />
				<ReviewStatBadge type="learning" count={counts.learning} />
				<ReviewStatBadge type="due" count={counts.due} />
				{crammingMode && (
					<div class="ep:flex ep:items-center ep:justify-center ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold ep:bg-obs-orange/20 ep:text-obs-orange ep:ml-1">
						Cram
					</div>
				)}
			</div>
		</div>
	);
}
