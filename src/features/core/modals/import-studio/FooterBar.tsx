import { CopyPromptButton } from "@features/core/modals/add-flashcards/CopyPromptButton";
import { NoteTypePicker } from "@features/core/modals/add-flashcards/NoteTypePicker";
import type { NoteType } from "@shared/types/note.types";
import { Clickable } from "@shared/ui/components/Clickable";

interface FooterBarProps {
	sessionCount: number;
	cardCount: number;
	detectedFormat: string;
	saving: boolean;
	noteType: NoteType | null;
	noteTypeId: string;
	onNoteTypeChange: (id: string) => void;
	onSave: () => void;
}

export function FooterBar({
	sessionCount,
	cardCount,
	detectedFormat,
	saving,
	noteType,
	noteTypeId,
	onNoteTypeChange,
	onSave,
}: FooterBarProps) {
	return (
		<div class="ep-modal-footer ep:flex ep:items-center ep:gap-2">
			<CopyPromptButton noteType={noteType ?? undefined} />
			<NoteTypePicker value={noteTypeId} onChange={onNoteTypeChange} />

			<div class="ep:flex-1 ep:text-ui-smaller ep:text-obs-muted ep:text-center">
				{cardCount > 0
					? `Format: ${detectedFormat} · ${cardCount} card${cardCount !== 1 ? "s" : ""}`
					: sessionCount > 0
						? `${sessionCount} card${sessionCount !== 1 ? "s" : ""} saved this session`
						: null}
			</div>

			<Clickable
				class="mod-cta ep-btn"
				onClick={onSave}
				disabled={cardCount === 0 || saving}
				stopPropagation={false}
			>
				{saving
					? "Saving..."
					: `Save ${cardCount > 0 ? `${cardCount} ` : ""}Card${
							cardCount !== 1 ? "s" : ""
						}`}
			</Clickable>
		</div>
	);
}
