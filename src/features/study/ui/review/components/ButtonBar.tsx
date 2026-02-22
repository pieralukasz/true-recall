import { RatingButton } from "@features/study/ui/review/components/RatingButton";
import type { SchedulingPreview } from "@shared/types";
import { useIcon } from "@shared/ui/preact/hooks";
import type { Grade } from "ts-fsrs";
import { Rating } from "ts-fsrs";

const BASE_BTN_CLS =
	"ep:flex ep:flex-col ep:items-center ep:gap-1 !ep:py-4 ep:px-6 ep:h-auto ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:min-w-20 ep:whitespace-nowrap ep:transition-transform ep:hover:brightness-110 ep:active:scale-98";

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
						<button type="button" class="ep-btn mod-cta" onClick={onShowAnswer}>
							Show answer
						</button>
					) : (
						<>
							<RatingButton
								label="Again"
								rating={Rating.Again}
								cls={`${BASE_BTN_CLS} ep:bg-obs-red ep:text-obs-on-accent`}
								interval={preview?.again.interval}
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
							/>
							<RatingButton
								label="Hard"
								rating={Rating.Hard}
								cls={`${BASE_BTN_CLS} ep:bg-obs-orange ep:text-obs-on-accent`}
								interval={preview?.hard.interval}
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
							/>
							<RatingButton
								label="Good"
								rating={Rating.Good}
								cls={`${BASE_BTN_CLS} ep:bg-obs-green ep:text-obs-on-accent`}
								interval={preview?.good.interval}
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
							/>
							<RatingButton
								label="Easy"
								rating={Rating.Easy}
								cls={`${BASE_BTN_CLS} ep:bg-obs-cyan ep:text-obs-on-accent`}
								interval={preview?.easy.interval}
								showInterval={showNextReviewTime}
								onAnswer={onAnswer}
							/>
						</>
					)}
				</div>

				<button
					type="button"
					class="ep:flex ep:items-center ep:justify-center ep:w-10 ep:h-10 ep:p-0 ep:border-none ep:rounded-lg ep:bg-obs-modifier-hover ep:text-obs-muted ep:cursor-pointer ep:transition-colors ep:absolute ep:right-0 ep:hover:bg-obs-border ep:hover:text-obs-normal ep:active:scale-95"
					aria-label="Card actions"
					onClick={onActionsMenu}
				>
					<div ref={menuIconRef} />
				</button>
			</div>
		</div>
	);
}
