import { Clickable } from "@shared/ui/components";
import { cva } from "class-variance-authority";
import type { Grade } from "ts-fsrs";
import { Rating } from "ts-fsrs";

const ratingButtonVariants = cva(
	"ep:flex ep:flex-col ep:items-center ep:gap-1 !ep:py-4 ep:px-6 ep:h-auto ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:min-w-20 ep:whitespace-nowrap ep:transition-transform ep:hover:brightness-110 ep:active:scale-98 ep:text-obs-on-accent",
	{
		variants: {
			rating: {
				[Rating.Again]: "ep:bg-obs-red",
				[Rating.Hard]: "ep:bg-obs-orange",
				[Rating.Good]: "ep:bg-obs-green",
				[Rating.Easy]: "ep:bg-obs-cyan",
			},
		},
	},
);

export function RatingButton({
	label,
	rating,
	interval,
	showInterval,
	onAnswer,
}: {
	label: string;
	rating: Grade;
	interval?: string;
	showInterval: boolean;
	onAnswer: (rating: Grade) => void;
}) {
	return (
		<Clickable
			class={ratingButtonVariants({ rating })}
			onClick={() => onAnswer(rating)}
		>
			<div class="ep:font-semibold">{label}</div>
			{interval && showInterval && (
				<div class="ep:text-ui-smaller ep:opacity-90">{interval}</div>
			)}
		</Clickable>
	);
}
