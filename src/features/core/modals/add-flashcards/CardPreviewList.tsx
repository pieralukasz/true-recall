import type { ParsedCard } from "@features/study/services/flashcard/bulk-card-parser";
import { BUILTIN_CLOZE_ID } from "@shared/types/note.types";

interface CardPreviewListProps {
	cards: ParsedCard[];
}

export function CardPreviewList({ cards }: CardPreviewListProps) {
	if (cards.length === 0) return null;

	const basicCount = cards.filter(
		(c) => c.noteTypeId !== BUILTIN_CLOZE_ID,
	).length;
	const clozeCount = cards.filter(
		(c) => c.noteTypeId === BUILTIN_CLOZE_ID,
	).length;

	return (
		<div class="ep:space-y-2">
			<div class="ep:text-ui-smaller ep:text-obs-muted">
				Detected: {cards.length} card{cards.length !== 1 ? "s" : ""}
				{clozeCount > 0 && basicCount > 0 && (
					<span>
						{" "}({basicCount} Basic, {clozeCount} Cloze)
					</span>
				)}
			</div>
			<div class="ep:max-h-[200px] ep:overflow-y-auto ep:space-y-1">
				{cards.map((card, i) => (
					<CardPreviewItem key={i} card={card} index={i} />
				))}
			</div>
		</div>
	);
}

function CardPreviewItem({
	card,
	index,
}: {
	card: ParsedCard;
	index: number;
}) {
	const isCloze = card.noteTypeId === BUILTIN_CLOZE_ID;
	const fieldEntries = Object.entries(card.fields);

	return (
		<div class="ep:flex ep:items-start ep:gap-2 ep:px-2 ep:py-1.5 ep:bg-obs-secondary ep:rounded ep:text-ui-smaller">
			<span class="ep:text-obs-faint ep:shrink-0 ep:tabular-nums ep:w-5 ep:text-right">
				{index + 1}.
			</span>
			<div class="ep:flex-1 ep:min-w-0">
				{isCloze ? (
					<span class="ep:text-obs-normal ep:line-clamp-2">
						{card.fields.Text}
					</span>
				) : (
					<span class="ep:text-obs-normal ep:line-clamp-1">
						{fieldEntries[0]?.[1]}
						<span class="ep:text-obs-faint ep:mx-1">&rarr;</span>
						{fieldEntries[1]?.[1]}
					</span>
				)}
			</div>
			{isCloze && (
				<span class="ep:shrink-0 ep:px-1 ep:py-0.5 ep:text-[10px] ep:bg-obs-accent/10 ep:text-obs-accent ep:rounded">
					Cloze
				</span>
			)}
		</div>
	);
}
