import { Notice } from "obsidian";
import { useCallback, useRef, useState } from "preact/hooks";

import { BatchCreateCommand } from "@true-recall/obsidian/commands/commands/card-create.cmd";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { canSaveQuickNote } from "../domain/quick-note-validation";
import type { QuickNoteEditorResult } from "../types";
import type { QuickNoteEditor } from "./useQuickNoteEditor";
import { useQuickNoteUndo } from "./useQuickNoteUndo";

export function useQuickNotePersistence(
	editor: QuickNoteEditor,
	onDone: (result: QuickNoteEditorResult) => void,
) {
	const {
		noteType,
		editMode,
		resolveSourceUid,
		plugin,
		sourceNoteFile,
		stateRef,
		revisionRef,
		dispatch,
		showSourcePicker,
		selectedSourceNote,
	} = editor;
	const savingRef = useRef(false);
	const [saving, setSaving] = useState(false);
	const { rememberCreate, handleUndoLastCreate } = useQuickNoteUndo(
		editor,
		savingRef,
	);
	const handleSave = useCallback(async () => {
		if (!noteType || savingRef.current) return false;
		if (showSourcePicker && !selectedSourceNote) return false;

		const draft = stateRef.current;
		const revision = revisionRef.current;
		const currentFields = draft.fields;
		const currentUserComment = draft.userComment;
		const primaryField = noteType.fields[0];
		if (!primaryField || !(currentFields[primaryField] ?? "").trim())
			return false;

		if (!plugin.flashcardManager?.hasStore()) {
			new Notice("Database not initialized");
			return false;
		}

		const fieldsChanged = editMode
			? noteType.fields.some(
					(fieldName) =>
						currentFields[fieldName] !== editMode.note.fields[fieldName],
				)
			: true;
		const commentChanged = editMode
			? currentUserComment !== (editMode.note.userComment ?? "")
			: true;

		if (editMode && !fieldsChanged && !commentChanged) {
			onDone({ cancelled: true });
			return true;
		}

		savingRef.current = true;
		setSaving(true);

		try {
			if (editMode) {
				const updatedCardIds = new Set<string>();
				if (fieldsChanged) {
					const result = plugin.flashcardManager.updateNoteFields(
						editMode.noteId,
						currentFields,
					);
					for (const cardId of result.updatedCardIds) {
						updatedCardIds.add(cardId);
					}
				}
				if (commentChanged) {
					for (const cardId of plugin.flashcardManager.updateNoteComment(
						editMode.noteId,
						currentUserComment,
					)) {
						updatedCardIds.add(cardId);
					}
				}

				onDone({
					cancelled: false,
					updatedCardIds: [...updatedCardIds],
				});
			} else {
				const sourceUid = await resolveSourceUid();
				const savedFields = { ...currentFields };

				const result = plugin.flashcardManager.createNote({
					noteTypeId: draft.noteTypeId,
					fields: currentFields,
					alwaysTypeIn: draft.alwaysTypeIn,
					userComment: currentUserComment,
					sourceUid,
					createdVia: "manual",
				});

				const commandService = plugin.commandService;
				if (commandService && result.cards.length > 0) {
					const command = new BatchCreateCommand(
						result.cards.map((card) => card.id),
					);
					await commandService.execute(command);
					rememberCreate(command, savedFields, currentUserComment, revision);
				}

				const totalCards = result.cards.length;
				notify().cardsCreated(totalCards, sourceNoteFile?.basename);

				if (revision === revisionRef.current)
					dispatch({ type: "saved", fieldNames: noteType.fields });
				savingRef.current = false;
				setSaving(false);
			}
			return true;
		} catch (error) {
			notify().operationFailed("save the flashcard", error);
			savingRef.current = false;
			setSaving(false);
			return false;
		}
	}, [
		noteType,
		editMode,
		resolveSourceUid,
		plugin.flashcardManager,
		plugin.commandService,
		onDone,
		stateRef,
		revisionRef,
		showSourcePicker,
		selectedSourceNote,
		dispatch,
		rememberCreate,
		sourceNoteFile,
	]);

	const handleSaveAndClose = useCallback(async () => {
		if (savingRef.current) return;
		const revision = revisionRef.current;
		if (canSaveQuickNote(stateRef.current.fields, noteType?.fields ?? [])) {
			if (!(await handleSave())) return;
		}
		if (revision !== revisionRef.current) return;
		onDone({ cancelled: false });
	}, [stateRef, revisionRef, noteType, handleSave, onDone]);
	return { saving, handleSave, handleSaveAndClose, handleUndoLastCreate };
}
