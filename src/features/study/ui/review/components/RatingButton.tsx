import type { Grade } from "ts-fsrs";

export function RatingButton({
	label,
	rating,
	cls,
	interval,
	showInterval,
	onAnswer,
}: {
	label: string;
	rating: Grade;
	cls: string;
	interval?: string;
	showInterval: boolean;
	onAnswer: (rating: Grade) => void;
}) {
	return (
		<button type="button" class={cls} onClick={() => onAnswer(rating)}>
			<div class="ep:font-semibold">{label}</div>
			{interval && showInterval && (
				<div class="ep:text-ui-smaller ep:opacity-90">{interval}</div>
			)}
		</button>
	);
}
