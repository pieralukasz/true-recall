import { cva } from "class-variance-authority";
import type { Grade } from "ts-fsrs";
import { Rating } from "ts-fsrs";

import { Clickable } from "@true-recall/obsidian/components";

const ratingButtonVariants = cva(
	"true-recall-rating-button ep:flex ep:flex-col ep:items-center ep:gap-1 ep:px-4 ep:h-auto ep:border ep:border-solid ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:min-w-20 ep:whitespace-nowrap ep:transition-all ep:bg-transparent ep:hover:brightness-110 ep:active:scale-98 ep:text-obs-normal",
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
	originalInterval,
	daysChanged,
	loadBalanceNote,
	showInterval,
	onAnswer,
	disabled = false,
}: {
	label: string;
	rating: Grade;
	interval?: string;
	originalInterval?: string;
	daysChanged?: number;
	loadBalanceNote?: string;
	showInterval: boolean;
	onAnswer: (rating: Grade) => void;
	disabled?: boolean;
}) {
	const shiftLabel =
		typeof daysChanged === "number" && daysChanged !== 0
			? `${daysChanged > 0 ? "+" : ""}${daysChanged}`
			: null;
	const title = buildTitle({
		interval,
		originalInterval,
		shiftLabel,
		loadBalanceNote,
	});

	return (
		<Clickable
			class={ratingButtonVariants({ rating })}
			onClick={() => onAnswer(rating)}
			disabled={disabled}
			title={title}
		>
			<div class="ep:font-semibold">{label}</div>
			{interval && showInterval && (
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					{interval}
					{shiftLabel && (
						<span class="ep:text-obs-orange"> ({shiftLabel})</span>
					)}
				</div>
			)}
			{showInterval && originalInterval && shiftLabel && (
				<div class="ep:text-[10px] ep:leading-none ep:text-obs-muted">
					FSRS {originalInterval}
				</div>
			)}
		</Clickable>
	);
}

function buildTitle({
	interval,
	originalInterval,
	shiftLabel,
	loadBalanceNote,
}: {
	interval?: string;
	originalInterval?: string;
	shiftLabel: string | null;
	loadBalanceNote?: string;
}): string | undefined {
	if (!interval && !loadBalanceNote) return undefined;
	const lines = [`Due: ${interval ?? "unknown"}`];
	if (originalInterval && shiftLabel) {
		lines.push(`FSRS: ${originalInterval}`);
		lines.push(`Load balance: ${interval} (${shiftLabel})`);
	} else if (loadBalanceNote) {
		lines.push("Load balance: no change");
	}
	if (loadBalanceNote) lines.push(loadBalanceNote);
	return lines.join("\n");
}
