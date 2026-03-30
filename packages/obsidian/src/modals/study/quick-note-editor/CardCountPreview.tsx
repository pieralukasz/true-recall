import { generateCardsForNote } from "@true-recall/core/services/cards/card-generation.service";
import type { NoteType } from "@true-recall/core/types/note.types";
import { useMemo } from "preact/hooks";

interface CardCountPreviewProps {
	noteType: NoteType;
	noteTypeId: string;
	fields: Record<string, string>;
	hasContent: boolean;
}

export function CardCountPreview({
	noteType,
	noteTypeId,
	fields,
	hasContent,
}: CardCountPreviewProps) {
	const cardCount = useMemo(() => {
		if (!hasContent) return 0;
		const draftNote = {
			id: "draft",
			noteTypeId,
			fields,
			tags: [] as string[],
		};
		return generateCardsForNote(draftNote, noteType).length;
	}, [noteType, noteTypeId, fields, hasContent]);

	if (!hasContent) return null;

	return (
		<div class="ep:text-ui-smaller ep:text-obs-muted">
			Will generate: {cardCount} card{cardCount !== 1 ? "s" : ""}
		</div>
	);
}
