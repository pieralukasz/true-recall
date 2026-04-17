import { cva } from "class-variance-authority";
import type { Grade } from "ts-fsrs";
import { Rating } from "ts-fsrs";

import type { SchedulingPreview } from "@true-recall/core";

import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { isMobile } from "@true-recall/obsidian/utils/platform";

import type { TypeInMode } from "../helpers/type-in-flow";
import { RatingButton } from "./RatingButton";

const typeInButtonVariants = cva(
	"ep:flex ep:items-center ep:justify-center ep:h-10 ep:px-3 ep:rounded-md ep:border ep:bg-obs-primary ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:transition-colors ep:transition-transform ep:duration-150 ep:focus-visible:outline-none ep:focus-visible:ring-2 ep:focus-visible:ring-obs-interactive/45 ep:active:scale-95",
	{
		variants: {
			mode: {
				ai: "ep:border-obs-interactive/45 ep:bg-obs-interactive/10 ep:text-obs-interactive ep:hover:border-obs-interactive/60 ep:hover:bg-obs-interactive/16",
				diff: "ep:border-obs-blue/35 ep:bg-obs-blue/10 ep:text-obs-blue ep:hover:border-obs-blue/45 ep:hover:bg-obs-blue/16",
				off: "ep:border-obs-border ep:hover:border-obs-modifier-border-hover ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
			},
		},
		defaultVariants: { mode: "off" },
	},
);

interface ButtonBarProps {
	isAnswerRevealed: boolean;
	preview: SchedulingPreview | null;
	showNextReviewTime: boolean;
	typeInMode?: TypeInMode;
	isRatingLocked?: boolean;
	compact?: boolean;
	onShowAnswer: () => void;
	onAnswer: (rating: Grade) => void;
	onCycleTypeInMode?: () => void;
	onActionsMenu?: (e: MouseEvent) => void;
}

export function ButtonBar({
	isAnswerRevealed,
	preview,
	showNextReviewTime,
	typeInMode = "off",
	isRatingLocked = false,
	compact = false,
	onShowAnswer,
	onAnswer,
	onCycleTypeInMode,
	onActionsMenu,
}: ButtonBarProps) {
	const menuIconRef = useIcon("more-vertical");
	const typeInEnabled = typeInMode !== "off";
	const typeInLabel =
		typeInMode === "ai"
			? "Type in \u00B7 AI"
			: typeInMode === "diff"
				? "Type in \u00B7 Diff"
				: "Type in";
	const typeInCurrent =
		typeInMode === "ai" ? "AI" : typeInMode === "diff" ? "Diff" : "Off";

	const mobile = isMobile();
	const hasSecondary = Boolean(onCycleTypeInMode || onActionsMenu);

	const ratingButtons = !isAnswerRevealed ? (
		<Clickable
			stopPropagation={false}
			class="ep-btn mod-cta"
			onClick={onShowAnswer}
		>
			Show answer
		</Clickable>
	) : (
		<>
			<RatingButton
				label="Again"
				rating={Rating.Again}
				interval={preview?.again.interval}
				showInterval={showNextReviewTime && !mobile}
				onAnswer={onAnswer}
				disabled={isRatingLocked}
			/>
			<RatingButton
				label="Hard"
				rating={Rating.Hard}
				interval={preview?.hard.interval}
				showInterval={showNextReviewTime && !mobile}
				onAnswer={onAnswer}
				disabled={isRatingLocked}
			/>
			<RatingButton
				label="Good"
				rating={Rating.Good}
				interval={preview?.good.interval}
				showInterval={showNextReviewTime && !mobile}
				onAnswer={onAnswer}
				disabled={isRatingLocked}
			/>
			<RatingButton
				label="Easy"
				rating={Rating.Easy}
				interval={preview?.easy.interval}
				showInterval={showNextReviewTime && !mobile}
				onAnswer={onAnswer}
				disabled={isRatingLocked}
			/>
		</>
	);

	const secondaryButtons = hasSecondary ? (
		<div class="ep:flex ep:items-center ep:gap-2">
			{onCycleTypeInMode && (
				<Clickable
					class={typeInButtonVariants({ mode: typeInMode })}
					aria-label={`Cycle type in mode (current: ${typeInCurrent})`}
					aria-pressed={typeInEnabled}
					title={`Cycle type in mode (T) \u00B7 current: ${typeInCurrent}`}
					onClick={onCycleTypeInMode}
				>
					{typeInLabel}
				</Clickable>
			)}

			{onActionsMenu && (
				<Clickable
					class="ep:flex ep:items-center ep:justify-center ep:w-10 ep:h-10 ep:p-0 ep:rounded-lg ep:bg-obs-modifier-hover ep:text-obs-muted ep:transition-colors ep:hover:bg-obs-border ep:hover:text-obs-normal ep:active:scale-95"
					aria-label="Card actions"
					onClick={onActionsMenu}
				>
					<div ref={menuIconRef} />
				</Clickable>
			)}
		</div>
	) : null;

	if (compact) {
		const row = mobile
			? "ep:flex ep:flex-wrap ep:justify-center ep:gap-2"
			: "ep:flex ep:justify-center ep:gap-3 ep:flex-nowrap";
		return <div class={row}>{ratingButtons}</div>;
	}

	if (mobile) {
		return (
			<div class="true-recall-review-buttons ep:flex ep:flex-col ep:gap-2 ep:border-t ep:border-obs-border ep:shrink-0 ep:px-3 ep:pt-2 ep:pb-3">
				<div class="ep:flex ep:justify-center ep:gap-2">{ratingButtons}</div>
				{secondaryButtons && (
					<div class="ep:flex ep:justify-center">{secondaryButtons}</div>
				)}
			</div>
		);
	}

	return (
		<div class="true-recall-review-buttons ep:relative ep:flex ep:justify-center ep:gap-3 ep:border-t ep:border-obs-border ep:flex-nowrap ep:shrink-0 ep:p-4">
			<div class="ep:flex ep:items-center ep:justify-center ep:w-full ep:relative">
				<div class="ep:flex ep:justify-center ep:gap-3 ep:flex-nowrap ep:py-4">
					{ratingButtons}
				</div>

				{secondaryButtons && (
					<div class="ep:absolute ep:right-0">{secondaryButtons}</div>
				)}
			</div>
		</div>
	);
}
