import { RatingButton } from "@features/study/ui/review/components/RatingButton";
import type { SchedulingPreview } from "@shared/types";
import { Clickable } from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact/hooks";
import type { Grade } from "ts-fsrs";
import { Rating } from "ts-fsrs";

export interface ButtonBarProps {
	isAnswerRevealed: boolean;
	preview: SchedulingPreview | null;
	showNextReviewTime: boolean;
	onShowAnswer: () => void;
	onAnswer: (rating: Grade) => void;
	onActionsMenu: (e: MouseEvent) => void;
}

export function ButtonBar({
	isAnswerRevealed,
	preview,
	showNextReviewTime,
	onShowAnswer,
	onAnswer,
	onActionsMenu,
}: ButtonBarProps) {
	const menuIconRef = useIcon("more-vertical");

	return (
		<div class="true-recall-review-buttons ep:flex ep:justify-center ep:gap-3 ep:border-t ep:border-obs-border ep:flex-nowrap ep:shrink-0 ep:p-4">
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
							/>
							<RatingButton
								label="Hard"
								rating={Rating.Hard}
								interval={preview?.hard.interval}
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
							/>
							<RatingButton
								label="Good"
								rating={Rating.Good}
								interval={preview?.good.interval}
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
							/>
							<RatingButton
								label="Easy"
								rating={Rating.Easy}
								interval={preview?.easy.interval}
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
							/>
						</>
					)}
				</div>

				<Clickable
					class="ep:flex ep:items-center ep:justify-center ep:w-10 ep:h-10 ep:p-0 ep:rounded-lg ep:bg-obs-modifier-hover ep:text-obs-muted ep:transition-colors ep:absolute ep:right-0 ep:hover:bg-obs-border ep:hover:text-obs-normal ep:active:scale-95"
					aria-label="Card actions"
					onClick={onActionsMenu}
				>
					<div ref={menuIconRef} />
				</Clickable>
			</div>
		</div>
	);
}
