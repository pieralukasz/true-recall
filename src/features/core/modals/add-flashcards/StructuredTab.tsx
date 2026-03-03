import { generateCardsForNote } from "@features/core/services/card-generation.service";
import { Clickable } from "@shared/ui/components/Clickable";
import { usePlugin } from "@shared/ui/preact/ObsidianContext";
import { SECONDARY_BUTTON_CLASSES } from "@shared/ui/utils/tailwind";
import type { NoteType } from "@shared/types/note.types";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { NoteTypePicker } from "./NoteTypePicker";

interface StructuredTabProps {
	defaultNoteTypeId: string;
	onNoteTypeChange: (id: string) => void;
	onSave: (noteTypeId: string, fields: Record<string, string>) => void | Promise<void>;
	onClose: () => void;
	sessionCount: number;
}

export function StructuredTab({
	defaultNoteTypeId,
	onNoteTypeChange,
	onSave,
	onClose,
	sessionCount,
}: StructuredTabProps) {
	const plugin = usePlugin();
	const [noteTypeId, setNoteTypeId] = useState(defaultNoteTypeId);
	const [fields, setFields] = useState<Record<string, string>>({});
	const firstFieldRef = useRef<HTMLTextAreaElement>(null);

	const noteType = useMemo<NoteType | null>(() => {
		if (!plugin.cardStore?.noteTypes) return null;
		return plugin.cardStore.noteTypes.getById(noteTypeId);
	}, [plugin.cardStore, noteTypeId]);

	// Reset fields when note type changes
	useEffect(() => {
		if (!noteType) return;
		const empty: Record<string, string> = {};
		for (const field of noteType.fields) {
			empty[field] = "";
		}
		setFields(empty);
	}, [noteType]);

	// Focus first field on mount
	useEffect(() => {
		firstFieldRef.current?.focus();
	}, [noteType]);

	const handleNoteTypeChange = useCallback(
		(id: string) => {
			setNoteTypeId(id);
			onNoteTypeChange(id);
		},
		[onNoteTypeChange],
	);

	const handleFieldChange = useCallback((fieldName: string, value: string) => {
		setFields((prev) => ({ ...prev, [fieldName]: value }));
	}, []);

	const hasContent = useMemo(
		() => Object.values(fields).some((v) => v.trim().length > 0),
		[fields],
	);

	// Compute how many cards will be generated
	const cardCount = useMemo(() => {
		if (!noteType || !hasContent) return 0;
		const draftNote = {
			id: "draft",
			noteTypeId,
			fields,
			tags: [] as string[],
		};
		return generateCardsForNote(draftNote, noteType).length;
	}, [noteType, noteTypeId, fields, hasContent]);

	const handleSaveAndAdd = useCallback(() => {
		if (!hasContent) return;
		onSave(noteTypeId, { ...fields });

		// Clear fields and refocus
		if (noteType) {
			const empty: Record<string, string> = {};
			for (const field of noteType.fields) {
				empty[field] = "";
			}
			setFields(empty);
		}
		setTimeout(() => firstFieldRef.current?.focus(), 50);
	}, [hasContent, noteTypeId, fields, onSave, noteType]);

	const handleSaveAndClose = useCallback(() => {
		if (!hasContent) return;
		onSave(noteTypeId, { ...fields });
		onClose();
	}, [hasContent, noteTypeId, fields, onSave, onClose]);

	if (!noteType) {
		return (
			<div class="ep:text-obs-muted ep:text-center ep:py-8">
				Loading note types...
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:gap-4">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:gap-3 ep:flex-wrap">
				<label class="ep:text-ui-smaller ep:text-obs-muted">Note type:</label>
				<NoteTypePicker value={noteTypeId} onChange={handleNoteTypeChange} />
			</div>

			{/* Dynamic fields */}
			<div class="ep:space-y-3">
				{noteType.fields.map((fieldName, idx) => (
					<div key={fieldName}>
						<label class="ep:text-ui-smaller ep:text-obs-muted ep:mb-1 ep:block">
							{fieldName}:
						</label>
						<textarea
							ref={idx === 0 ? firstFieldRef : undefined}
							class="ep:w-full ep:px-3 ep:py-2 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:min-h-[60px] ep:resize-y"
							value={fields[fieldName] ?? ""}
							onInput={(e) =>
								handleFieldChange(
									fieldName,
									(e.target as HTMLTextAreaElement).value,
								)
							}
						/>
					</div>
				))}
			</div>

			{/* Cloze hint */}
			{noteType.type === 1 && (
				<div class="ep:text-ui-smaller ep:text-obs-faint ep:bg-obs-secondary ep:px-3 ep:py-2 ep:rounded">
					Use <code class="ep:text-obs-accent">{"{{c1::text}}"}</code> syntax
					for cloze deletions. Multiple indices create multiple cards.
				</div>
			)}

			{/* Card count */}
			{hasContent && (
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					Will generate: {cardCount} card{cardCount !== 1 ? "s" : ""}
				</div>
			)}

			{/* Footer */}
			<div class="ep-modal-footer ep:flex ep:justify-between ep:items-center">
				<span class="ep:text-ui-smaller ep:text-obs-faint">
					{sessionCount > 0 &&
						`${sessionCount} card${sessionCount !== 1 ? "s" : ""} saved this session`}
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
						class={SECONDARY_BUTTON_CLASSES}
						onClick={handleSaveAndAdd}
						disabled={!hasContent}
						stopPropagation={false}
					>
						Save & Add Another
					</Clickable>
					<Clickable
						class="mod-cta ep-btn"
						onClick={handleSaveAndClose}
						disabled={!hasContent}
						stopPropagation={false}
					>
						Save & Close
					</Clickable>
				</div>
			</div>
		</div>
	);
}
