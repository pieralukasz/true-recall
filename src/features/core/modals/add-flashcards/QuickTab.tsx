import {
	parseBulkText,
	type ParsedCard,
} from "@features/study/services/flashcard/bulk-card-parser";
import { Clickable } from "@shared/ui/components/Clickable";
import { SECONDARY_BUTTON_CLASSES } from "@shared/ui/utils/tailwind";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { CardPreviewList } from "./CardPreviewList";
import { CopyPromptButton } from "./CopyPromptButton";
import { NoteTypePicker } from "./NoteTypePicker";

interface QuickTabProps {
	defaultNoteTypeId: string;
	onNoteTypeChange: (id: string) => void;
	onSave: (cards: ParsedCard[]) => void | Promise<void>;
	onClose: () => void;
	sessionCount: number;
}

export function QuickTab({
	defaultNoteTypeId,
	onNoteTypeChange,
	onSave,
	onClose,
	sessionCount,
}: QuickTabProps) {
	const textRef = useRef<HTMLTextAreaElement>(null);
	const [text, setText] = useState("");
	const [noteTypeId, setNoteTypeId] = useState(defaultNoteTypeId);

	const parseResult = useMemo(() => parseBulkText(text), [text]);

	// Override noteTypeId for non-cloze cards when user selects a different type
	const resolvedCards = useMemo(() => {
		return parseResult.cards.map((card) => {
			// Cloze cards keep their auto-detected type
			if (card.noteTypeId === "builtin-cloze") return card;
			// Other cards use the selected note type
			if (card.noteTypeId !== noteTypeId) {
				return { ...card, noteTypeId };
			}
			return card;
		});
	}, [parseResult.cards, noteTypeId]);

	const handleNoteTypeChange = useCallback(
		(id: string) => {
			setNoteTypeId(id);
			onNoteTypeChange(id);
		},
		[onNoteTypeChange],
	);

	const handleSave = useCallback(() => {
		if (resolvedCards.length === 0) return;
		onSave(resolvedCards);
		setText("");
		if (textRef.current) {
			textRef.current.value = "";
			textRef.current.focus();
		}
	}, [resolvedCards, onSave]);

	return (
		<div class="ep:flex ep:flex-col ep:gap-4">
			{/* Header: note type + source */}
			<div class="ep:flex ep:items-center ep:gap-3 ep:flex-wrap">
				<label class="ep:text-ui-smaller ep:text-obs-muted">Note type:</label>
				<NoteTypePicker value={noteTypeId} onChange={handleNoteTypeChange} />
			</div>

			{/* Text input */}
			<textarea
				ref={textRef}
				class="ep:w-full ep:min-h-[200px] ep:px-3 ep:py-2 ep:text-ui-small ep:font-mono ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:resize-y ep:placeholder-obs-faint"
				placeholder={"Paste or type flashcards...\n\nSupported formats:\n  Question :: Answer\n  Question\\tAnswer (tab-separated)\n  Q: Question\\nA: Answer\n  {{c1::cloze text}} for cloze cards"}
				value={text}
				onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
			/>

			{/* Preview + copy prompt */}
			<div class="ep:flex ep:items-start ep:justify-between ep:gap-4">
				<CopyPromptButton />
				{parseResult.cards.length > 0 && (
					<span class="ep:text-ui-smaller ep:text-obs-muted">
						Format: {parseResult.detectedFormat}
					</span>
				)}
			</div>

			<CardPreviewList cards={resolvedCards} />

			{/* Footer */}
			<div class="ep-modal-footer ep:flex ep:justify-between ep:items-center">
				<span class="ep:text-ui-smaller ep:text-obs-faint">
					{sessionCount > 0 && `${sessionCount} card${sessionCount !== 1 ? "s" : ""} saved this session`}
				</span>
				<div class="ep:flex ep:items-center ep:gap-3">
					<Clickable
						class={SECONDARY_BUTTON_CLASSES}
						onClick={onClose}
						stopPropagation={false}
					>
						Close
					</Clickable>
					<Clickable
						class="mod-cta ep-btn"
						onClick={handleSave}
						disabled={resolvedCards.length === 0}
						stopPropagation={false}
					>
						Save {resolvedCards.length > 0 ? `${resolvedCards.length} ` : ""}Card{resolvedCards.length !== 1 ? "s" : ""}
					</Clickable>
				</div>
			</div>
		</div>
	);
}
