import type { ReviewApi } from "@shared/store";
import { cva } from "class-variance-authority";

const reviewStatVariants = cva("ep:font-bold", {
	variants: {
		type: {
			new: "ep:text-obs-green",
			learning: "ep:text-obs-orange",
			due: "ep:text-obs-blue",
		},
	},
});

function ReviewStat({
	label,
	type,
	count,
}: {
	label: string;
	type: "new" | "learning" | "due";
	count: number;
}) {
	return (
		<span class="ep:flex ep:items-center ep:gap-1.5">
			<span class="ep:text-obs-muted">{label}</span>
			<span class={reviewStatVariants({ type })}>{count}</span>
		</span>
	);
}

function Dot() {
	return <span class="ep:text-obs-faint ep:mx-1">&middot;</span>;
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
		<div class="ep:flex ep:justify-center ep:items-center ep:relative ep:shrink-0 ep:p-2 ep:pb-4">
			<div class="ep:flex ep:items-center ep:text-ui-smaller ep:font-medium">
				<ReviewStat label="New" type="new" count={counts.new} />
				<Dot />
				<ReviewStat label="Learning" type="learning" count={counts.learning} />
				<Dot />
				<ReviewStat label="Due" type="due" count={counts.due} />
				{crammingMode && (
					<>
						<Dot />
						<span class="ep:flex ep:items-center ep:justify-center ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold ep:bg-obs-orange/20 ep:text-obs-orange">
							Cram
						</span>
					</>
				)}
			</div>
		</div>
	);
}
