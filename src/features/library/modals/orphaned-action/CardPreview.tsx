import type { FSRSCardData } from "../../../../shared/types";

const MAX_PREVIEW = 3;
const MAX_QUESTION_LENGTH = 80;

export function CardPreview({ cards }: { cards: FSRSCardData[] }) {
	const cardsToShow = cards.slice(0, MAX_PREVIEW);

	return (
		<div class="ep:mb-4 ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:border ep:border-obs-border">
			<h4 class="ep:text-ui-smaller ep:text-obs-muted ep:m-0 ep:mb-2">
				Card preview
			</h4>
			{cardsToShow.map((card) => {
				const question = card.question ?? "No question";
				const truncatedQ =
					question.length > MAX_QUESTION_LENGTH
						? `${question.slice(0, MAX_QUESTION_LENGTH)}...`
						: question;
				return (
					<div
						key={card.id}
						class="ep:py-1.5 ep:border-b ep:border-obs-border ep:last:border-b-0"
					>
						<div class="ep:text-ui-smaller ep:text-obs-normal">
							Q: {truncatedQ}
						</div>
					</div>
				);
			})}
			{cards.length > MAX_PREVIEW && (
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:pt-1">
					... and {cards.length - MAX_PREVIEW} more
				</div>
			)}
		</div>
	);
}
