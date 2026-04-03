import { Clickable } from "@true-recall/obsidian/components";
import { cva } from "class-variance-authority";
import type { Grade } from "ts-fsrs";
import { Rating } from "ts-fsrs";

const ratingButtonVariants = cva(
	"ep:flex ep:flex-col ep:items-center ep:gap-1 ep:!py-2 ep:px-4 ep:h-auto ep:border ep:border-solid ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:min-w-20 ep:whitespace-nowrap ep:transition-all ep:bg-transparent ep:hover:brightness-110 ep:active:scale-98 ep:text-obs-normal",
	{
		variants: {
			rating: {
				[Rating.Again]: "ep:border-obs-red/30 ep:hover:bg-obs-red/10",
				[Rating.Hard]: "ep:border-obs-orange/30 ep:hover:bg-obs-orange/10",
				[Rating.Good]: "ep:border-obs-green/30 ep:hover:bg-obs-green/10",
				[Rating.Easy]: "ep:border-obs-cyan/30 ep:hover:bg-obs-cyan/10",
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
	disabled = false,
}: {
	label: string;
	rating: Grade;
	interval?: string;
	showInterval: boolean;
	onAnswer: (rating: Grade) => void;
	disabled?: boolean;
}) {
	return (
		<Clickable
			class={ratingButtonVariants({ rating })}
			onClick={() => onAnswer(rating)}
			disabled={disabled}
		>
			<div class="ep:font-semibold">{label}</div>
			{interval && showInterval && (
				<div class="ep:text-ui-smaller ep:text-obs-muted">{interval}</div>
			)}
		</Clickable>
	);
}
