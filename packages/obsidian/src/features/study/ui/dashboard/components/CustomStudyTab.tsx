import type { TemporaryCustomStudyDeck } from "@true-recall/core/types";

import { CustomStudySessionRow } from "./CustomStudySessionRow";

interface CustomStudyTabProps {
	decks: readonly TemporaryCustomStudyDeck[];
}

export function CustomStudyTab({ decks }: CustomStudyTabProps) {
	return (
		<section class="ep:flex ep:flex-col">
			{decks.length === 0 ? (
				<div class="ep:text-sm ep:text-obs-muted ep:p-4 ep:text-center">
					No custom study sessions yet.
				</div>
			) : (
				<div class="ep:flex ep:flex-col">
					{decks.map((deck) => (
						<CustomStudySessionRow key={deck.id} deck={deck} />
					))}
				</div>
			)}
		</section>
	);
}
