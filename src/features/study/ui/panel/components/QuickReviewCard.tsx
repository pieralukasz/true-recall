import type { SchedulingPreview } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { Clickable } from "@shared/ui/components";
import { type Grade, Rating } from "ts-fsrs";

const RATING_BTN_BASE =
	"ep:flex ep:flex-col ep:items-center ep:gap-0.5 ep:py-2 ep:px-3 ep:border-none ep:rounded-md ep:cursor-pointer ep:font-medium ep:text-ui-smaller ep:min-w-14 ep:transition-transform ep:hover:brightness-110 ep:active:scale-95";

interface QuickReviewCardProps {
	card: FSRSFlashcardItem;
	answerShown: boolean;
	preview: SchedulingPreview | null;
	remaining: number;
	onShowAnswer: () => void;
	onRate: (rating: Grade) => void;
}

export function QuickReviewCard({
	card,
	answerShown,
	preview,
	remaining,
	onShowAnswer,
	onRate,
}: QuickReviewCardProps) {
	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<div class="ep:text-xs ep:text-obs-muted ep:font-medium">
				Q: {card.question}
			</div>

			{answerShown ? (
				<>
					<div class="ep:border-t ep:border-obs-modifier-border ep:pt-2 ep:text-xs">
						A: {card.answer}
					</div>

					<div class="ep:flex ep:justify-center ep:gap-2 ep:pt-1">
						<Clickable
							class={`${RATING_BTN_BASE} ep:bg-obs-red ep:text-obs-on-accent`}
							onClick={() => onRate(Rating.Again)}
						>
							<span>Again</span>
							{preview && (
								<span class="ep:text-[10px] ep:opacity-80">
									{preview.again.interval}
								</span>
							)}
						</Clickable>
						<Clickable
							class={`${RATING_BTN_BASE} ep:bg-obs-orange ep:text-obs-on-accent`}
							onClick={() => onRate(Rating.Hard)}
						>
							<span>Hard</span>
							{preview && (
								<span class="ep:text-[10px] ep:opacity-80">
									{preview.hard.interval}
								</span>
							)}
						</Clickable>
						<Clickable
							class={`${RATING_BTN_BASE} ep:bg-obs-green ep:text-obs-on-accent`}
							onClick={() => onRate(Rating.Good)}
						>
							<span>Good</span>
							{preview && (
								<span class="ep:text-[10px] ep:opacity-80">
									{preview.good.interval}
								</span>
							)}
						</Clickable>
						<Clickable
							class={`${RATING_BTN_BASE} ep:bg-obs-cyan ep:text-obs-on-accent`}
							onClick={() => onRate(Rating.Easy)}
						>
							<span>Easy</span>
							{preview && (
								<span class="ep:text-[10px] ep:opacity-80">
									{preview.easy.interval}
								</span>
							)}
						</Clickable>
					</div>

					<div class="ep:text-[10px] ep:text-obs-muted ep:text-center">
						{remaining} remaining
					</div>
				</>
			) : (
				<Clickable
					stopPropagation={false}
					class="ep-btn mod-cta ep:text-xs ep:py-1.5"
					onClick={onShowAnswer}
				>
					Show Answer
				</Clickable>
			)}
		</div>
	);
}
