import { RatingButton } from "@features/study/ui/review/components/RatingButton";
import type { TypeInMode } from "@features/study/ui/review/helpers/type-in-flow";
import type { SchedulingPreview } from "@shared/types";
import { Clickable } from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact/hooks";
import { cn } from "@shared/ui/utils/cn";
import type { Grade } from "ts-fsrs";
import { Rating } from "ts-fsrs";

export interface ButtonBarProps {
	isAnswerRevealed: boolean;
	preview: SchedulingPreview | null;
	showNextReviewTime: boolean;
	typeInMode: TypeInMode;
	isRatingLocked: boolean;
	onShowAnswer: () => void;
	onAnswer: (rating: Grade) => void;
	onCycleTypeInMode: () => void;
	onActionsMenu: (e: MouseEvent) => void;
}

export function ButtonBar({
	isAnswerRevealed,
	preview,
	showNextReviewTime,
	typeInMode,
	isRatingLocked,
	onShowAnswer,
	onAnswer,
	onCycleTypeInMode,
	onActionsMenu,
}: ButtonBarProps) {
	const menuIconRef = useIcon("more-vertical");
	const typeInEnabled = typeInMode !== "off";
	const typeInLabel =
		typeInMode === "ai"
			? "Type in · AI"
			: typeInMode === "diff"
				? "Type in · Diff"
				: "Type in";
	const typeInCurrent =
		typeInMode === "ai" ? "AI" : typeInMode === "diff" ? "Diff" : "Off";

	return (
		<div class="true-recall-review-buttons ep:relative ep:flex ep:justify-center ep:gap-3 ep:border-t ep:border-obs-border ep:flex-nowrap ep:shrink-0 ep:p-4">
			<div class="ep:flex ep:items-center ep:justify-center ep:w-full ep:relative">
				<div class="ep:flex ep:justify-center ep:gap-3 ep:flex-nowrap ep:py-4">
					{!isAnswerRevealed ? (
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
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
								disabled={isRatingLocked}
							/>
							<RatingButton
								label="Hard"
								rating={Rating.Hard}
								interval={preview?.hard.interval}
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
								disabled={isRatingLocked}
							/>
							<RatingButton
								label="Good"
								rating={Rating.Good}
								interval={preview?.good.interval}
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
								disabled={isRatingLocked}
							/>
							<RatingButton
								label="Easy"
								rating={Rating.Easy}
								interval={preview?.easy.interval}
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
								disabled={isRatingLocked}
							/>
						</>
					)}
				</div>

				<div class="ep:flex ep:items-center ep:gap-2 ep:absolute ep:right-0">
					<Clickable
						class={cn(
							"ep:flex ep:items-center ep:justify-center ep:h-10 ep:px-3 ep:rounded-md ep:border ep:bg-obs-primary ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:transition-colors ep:transition-transform ep:duration-150 ep:focus-visible:outline-none ep:focus-visible:ring-2 ep:focus-visible:ring-obs-interactive/45 ep:active:scale-95",
							typeInMode === "ai" &&
								"ep:border-obs-interactive/45 ep:bg-obs-interactive/10 ep:text-obs-interactive ep:hover:border-obs-interactive/60 ep:hover:bg-obs-interactive/16",
							typeInMode === "diff" &&
								"ep:border-obs-blue/35 ep:bg-obs-blue/10 ep:text-obs-blue ep:hover:border-obs-blue/45 ep:hover:bg-obs-blue/16",
							typeInMode === "off" &&
								"ep:border-obs-border ep:hover:border-obs-modifier-border-hover ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
						)}
						aria-label={`Cycle type in mode (current: ${typeInCurrent})`}
						aria-pressed={typeInEnabled}
						title={`Cycle type in mode (T) · current: ${typeInCurrent}`}
						onClick={onCycleTypeInMode}
					>
						{typeInLabel}
					</Clickable>

					<Clickable
						class="ep:flex ep:items-center ep:justify-center ep:w-10 ep:h-10 ep:p-0 ep:rounded-lg ep:bg-obs-modifier-hover ep:text-obs-muted ep:transition-colors ep:hover:bg-obs-border ep:hover:text-obs-normal ep:active:scale-95"
						aria-label="Card actions"
						onClick={onActionsMenu}
					>
						<div ref={menuIconRef} />
					</Clickable>
				</div>
			</div>
		</div>
	);
}
