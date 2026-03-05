import { CopyPromptButton } from "@features/core/modals/add-flashcards/CopyPromptButton";
import type { NoteType } from "@shared/types/note.types";

interface MetaRowProps {
	noteType: NoteType | null;
	detectedFormat: string;
	cardCount: number;
}

export function MetaRow({ noteType, detectedFormat, cardCount }: MetaRowProps) {
	return (
		<div class="ep:flex ep:items-center ep:justify-between ep:gap-4">
			<CopyPromptButton noteType={noteType ?? undefined} />
			{cardCount > 0 && (
				<span class="ep:text-ui-smaller ep:text-obs-muted">
					Format: {detectedFormat} · {cardCount} card{cardCount !== 1 ? "s" : ""}
				</span>
			)}
		</div>
	);
}
