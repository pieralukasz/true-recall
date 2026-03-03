import { Clickable } from "@shared/ui/components/Clickable";
import { NotePickerCombobox } from "@shared/ui/modals/simple-editor/NotePickerCombobox";
import { useApp, usePlugin } from "@shared/ui/preact/ObsidianContext";
import { SECONDARY_BUTTON_CLASSES } from "@shared/ui/utils/tailwind";
import { Notice, TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { NoteTypePicker } from "@features/core/modals/add-flashcards/NoteTypePicker";
import { CardCountPreview } from "./CardCountPreview";
import { NoteFieldsForm } from "./NoteFieldsForm";
import type {
	AddMode,
	EditMode,
	QuickNoteEditorMode,
	QuickNoteEditorResult,
} from "./types";

interface QuickNoteEditorAppProps {
	mode: QuickNoteEditorMode;
	onDone: (result: QuickNoteEditorResult) => void;
	onClose: () => void;
}

export function QuickNoteEditorApp({
	mode,
	onDone,
	onClose,
}: QuickNoteEditorAppProps) {
	const app = useApp();
	const plugin = usePlugin();

	const isEdit = mode.mode === "edit";
	const editMode = isEdit ? (mode as EditMode) : null;
	const addMode = !isEdit ? (mode as AddMode) : null;

	// ── State ──

	const [noteTypeId, setNoteTypeId] = useState(
		isEdit
			? editMode!.noteType.id
			: addMode!.defaultNoteTypeId ?? "builtin-basic",
	);

	const [fields, setFields] = useState<Record<string, string>>(() => {
		if (isEdit) return { ...editMode!.note.fields };
		return {};
	});

	const [saving, setSaving] = useState(false);

	// Source note picker — only shown in add mode without pre-set sourceUid
	const showSourcePicker = !isEdit && !addMode!.sourceUid;
	const [selectedSourceNote, setSelectedSourceNote] =
		useState<TFile | null>(null);

	// ── Derived ──

	const noteType = useMemo(() => {
		if (isEdit) return editMode!.noteType;
		return plugin.cardStore?.noteTypes?.getById(noteTypeId) ?? null;
	}, [isEdit, editMode, plugin.cardStore, noteTypeId]);

	const hasContent = useMemo(
		() => Object.values(fields).some((v) => v.trim().length > 0),
		[fields],
	);

	// Initialize empty fields when note type changes in add mode
	useEffect(() => {
		if (isEdit || !noteType) return;
		setFields((prev) => {
			const next: Record<string, string> = {};
			for (const fieldName of noteType.fields) {
				// Carry over values for fields with matching names
				next[fieldName] = prev[fieldName] ?? "";
			}
			return next;
		});
	}, [noteType, isEdit]);

	// ── Handlers ──

	const handleFieldChange = useCallback(
		(fieldName: string, value: string) => {
			setFields((prev) => ({ ...prev, [fieldName]: value }));
		},
		[],
	);

	const handleNoteTypeChange = useCallback((id: string) => {
		setNoteTypeId(id);
	}, []);

	const resolveSourceUid = useCallback(async (): Promise<
		string | undefined
	> => {
		// Edit mode: keep existing sourceUid
		if (isEdit) return editMode!.note.sourceUid;

		// Add mode with pre-set sourceUid (from review card)
		if (addMode!.sourceUid) return addMode!.sourceUid;

		// Add mode with selected source note
		if (!selectedSourceNote || !plugin.flashcardManager) return undefined;
		const fmService = plugin.flashcardManager.getFrontmatterService();
		let uid = await fmService.getSourceNoteUid(selectedSourceNote);
		if (!uid) {
			uid = fmService.generateUid();
			await fmService.setSourceNoteUid(selectedSourceNote, uid);
		}
		return uid;
	}, [isEdit, editMode, addMode, selectedSourceNote, plugin.flashcardManager]);

	const handleSave = useCallback(
		async (andAddAnother: boolean) => {
			if (!noteType || !hasContent || saving) return;
			if (!plugin.flashcardManager?.hasStore()) {
				new Notice("Database not initialized");
				return;
			}

			setSaving(true);

			try {
				if (isEdit) {
					// Check if fields actually changed
					const unchanged = noteType.fields.every(
						(f) => fields[f] === editMode!.note.fields[f],
					);
					if (unchanged) {
						onDone({ cancelled: true });
						return;
					}

					const result =
						plugin.flashcardManager.updateNoteFields(
							editMode!.noteId,
							fields,
						);

					onDone({
						cancelled: false,
						updatedCardIds: result.updatedCardIds,
					});
				} else {
					const sourceUid = await resolveSourceUid();

					const result = plugin.flashcardManager.createNote({
						noteTypeId,
						fields,
						sourceUid,
						createdVia: "manual",
					});

					const totalCards = result.cards.length;
					new Notice(
						`Created ${totalCards} card${totalCards !== 1 ? "s" : ""}`,
					);

					if (andAddAnother) {
						// Clear fields, keep note type and source note
						const empty: Record<string, string> = {};
						for (const field of noteType.fields) {
							empty[field] = "";
						}
						setFields(empty);
						setSaving(false);
						return;
					}

					onDone({
						cancelled: false,
						createdNote: result.note,
						createdCards: result.cards,
					});
				}
			} catch (error) {
				const msg =
					error instanceof Error ? error.message : String(error);
				new Notice(`Error: ${msg}`);
				setSaving(false);
			}
		},
		[
			noteType,
			hasContent,
			saving,
			isEdit,
			editMode,
			fields,
			noteTypeId,
			resolveSourceUid,
			plugin.flashcardManager,
			onDone,
		],
	);

	// Note: Cmd/Ctrl+Enter is handled by EmbeddableEditor's Scope (via onModEnter
	// passed to NoteFieldsForm). No document listener needed — the Scope intercepts
	// before the event reaches the document when a CM6 field has focus.

	if (!noteType) {
		return (
			<div class="ep:text-obs-muted ep:text-center ep:py-8">
				Loading note types...
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:gap-4">
			{/* Note type picker */}
			<div class="ep:flex ep:items-center ep:gap-3">
				<label class="ep:text-ui-smaller ep:text-obs-muted">
					Note type:
				</label>
				<NoteTypePicker
					value={noteTypeId}
					onChange={handleNoteTypeChange}
					disabled={isEdit}
				/>
			</div>

			{/* Source note picker (add mode, no pre-set sourceUid) */}
			{showSourcePicker && (
				<div class="ep:flex ep:items-center ep:gap-3">
					<label class="ep:text-ui-smaller ep:text-obs-muted ep:shrink-0">
						Source note:
					</label>
					<div class="ep:flex-1">
						<NotePickerCombobox
							app={app}
							selectedNote={selectedSourceNote}
							onSelect={setSelectedSourceNote}
						/>
					</div>
					{selectedSourceNote && (
						<Clickable
							class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal"
							onClick={() => setSelectedSourceNote(null)}
						>
							Clear
						</Clickable>
					)}
				</div>
			)}

			{/* Dynamic fields */}
			<NoteFieldsForm
				noteType={noteType}
				fields={fields}
				onFieldChange={handleFieldChange}
				onModEnter={() => handleSave(false)}
			/>

			{/* Card count preview */}
			{!isEdit && (
				<CardCountPreview
					noteType={noteType}
					noteTypeId={noteTypeId}
					fields={fields}
					hasContent={hasContent}
				/>
			)}

			{/* Footer */}
			<div class="ep-modal-footer ep:flex ep:justify-end ep:items-center ep:gap-3">
				<Clickable
					class={SECONDARY_BUTTON_CLASSES}
					onClick={onClose}
					stopPropagation={false}
				>
					Cancel
				</Clickable>

				{!isEdit && (
					<Clickable
						class={SECONDARY_BUTTON_CLASSES}
						onClick={() => handleSave(true)}
						disabled={!hasContent || saving}
						stopPropagation={false}
					>
						Save & Add Another
					</Clickable>
				)}

				<Clickable
					class="mod-cta ep-btn"
					onClick={() => handleSave(false)}
					disabled={!hasContent || saving}
					stopPropagation={false}
				>
					{isEdit ? "Save Changes" : "Save & Close"}
				</Clickable>
			</div>
		</div>
	);
}
