import type { EditorView } from "@codemirror/view";
import { TFile } from "obsidian";
import {
	useCallback,
	useEffect,
	useReducer,
	useRef,
	useState,
} from "preact/hooks";

import type { FormattingTargetRef } from "@true-recall/obsidian/editor/shared/formatting";
import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";
import { openCardTypesEditor } from "@true-recall/obsidian/views/modal-window/open-card-types-editor";
import { openNoteTypeManager } from "@true-recall/obsidian/views/modal-window/open-note-type-manager";

import {
	createQuickNoteState,
	type QuickNoteAction,
	quickNoteReducer,
} from "../domain/quick-note-state";
import {
	canSaveQuickNote,
	isQuickNoteDirty,
} from "../domain/quick-note-validation";
import type { QuickNoteEditorMode, QuickNoteEditorResult } from "../types";

export function useQuickNoteEditor(
	mode: QuickNoteEditorMode,
	onDone: (result: QuickNoteEditorResult) => void,
	onDirtyChange?: (dirty: boolean) => void,
) {
	const app = useApp();
	const plugin = usePlugin();
	const isEdit = mode.mode === "edit";
	const editMode = mode.mode === "edit" ? mode : null;
	const addMode = mode.mode === "add" ? mode : null;
	const initialType =
		editMode?.noteType ??
		plugin.cardStore?.noteTypes?.getById(
			addMode?.defaultNoteTypeId ?? "builtin-basic",
		);
	const [state, reduce] = useReducer(quickNoteReducer, mode, (initialMode) =>
		createQuickNoteState(initialMode, initialType?.fields ?? []),
	);
	// CodeMirror commits immediately before Cmd+Enter; a render may not have happened yet.
	const stateRef = useRef(state);
	const revisionRef = useRef(0);
	const dispatch = useCallback((action: QuickNoteAction) => {
		stateRef.current = quickNoteReducer(stateRef.current, action);
		reduce(action);
	}, []);
	const invalidatePendingCreateUndo = useCallback(() => {
		revisionRef.current += 1;
	}, []);
	const edit = useCallback(
		(action: QuickNoteAction) => {
			invalidatePendingCreateUndo();
			dispatch(action);
		},
		[dispatch, invalidatePendingCreateUndo],
	);
	const [, refresh] = useState(0);
	const noteType = isEdit
		? editMode?.noteType
		: plugin.cardStore?.noteTypes?.getById(state.noteTypeId);
	const showSourcePicker = !isEdit && !addMode?.sourceUid;
	const [selectedSourceNote, setSelectedSourceNote] = useState<TFile | null>(
		() => {
			const active = app.workspace.getActiveFile();
			return showSourcePicker && active?.extension === "md" ? active : null;
		},
	);
	const sourceUid = addMode?.sourceUid ?? editMode?.note.sourceUid;
	const sourcePath = sourceUid
		? plugin.frontmatterIndex?.getFileByValue("flashcard_uid", sourceUid)
		: null;
	const sourceFile = sourcePath
		? app.vault.getAbstractFileByPath(sourcePath)
		: null;
	const sourceNoteFile = showSourcePicker
		? selectedSourceNote
		: sourceFile instanceof TFile
			? sourceFile
			: null;
	const isDirty = isQuickNoteDirty(mode, state.fields, state.userComment);
	const canSave = canSaveQuickNote(state.fields, noteType?.fields ?? []);
	useEffect(() => {
		onDirtyChange?.(isDirty);
	}, [isDirty, onDirtyChange]);
	const focusedFieldRef = useRef<FormattingTargetRef | null>(null);
	const userCommentInputRef = useRef<HTMLTextAreaElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const handleFieldFocus = useCallback(
		(fieldName: string, editorView: EditorView) => {
			focusedFieldRef.current = { fieldName, editorView };
		},
		[],
	);
	const handleFieldChange = useCallback(
		(name: string, value: string) => {
			if (stateRef.current.fields[name] !== value)
				edit({ type: "field", name, value });
		},
		[edit],
	);
	const handleNoteTypeChange = useCallback(
		(id: string) => {
			const next = plugin.cardStore.noteTypes.getById(id);
			edit({ type: "noteType", id, fieldNames: next?.fields ?? [] });
		},
		[plugin, edit],
	);
	const handleUserCommentChange = useCallback(
		(value: string) => edit({ type: "comment", value }),
		[edit],
	);
	const handleSourceSelect = useCallback(
		(file: TFile | null) => {
			invalidatePendingCreateUndo();
			setSelectedSourceNote(file);
		},
		[invalidatePendingCreateUndo],
	);
	const handleTypeInToggle = useCallback(
		(enabled: boolean) => edit({ type: "typeIn", enabled }),
		[edit],
	);
	const togglePin = useCallback(
		(name: string) => dispatch({ type: "pin", name }),
		[dispatch],
	);
	const handleNoteTypeRefresh = useCallback(() => {
		if (!isEdit) {
			const current = stateRef.current;
			const next = plugin.cardStore.noteTypes.getById(current.noteTypeId);
			if (next)
				edit({ type: "noteType", id: next.id, fieldNames: next.fields });
		}
		refresh((value) => value + 1);
	}, [isEdit, plugin, edit]);
	const openFields = useCallback(
		() => openNoteTypeManager(plugin, { onClose: handleNoteTypeRefresh }),
		[plugin, handleNoteTypeRefresh],
	);
	const openCards = useCallback(
		() =>
			openCardTypesEditor(plugin, stateRef.current.noteTypeId, {
				onClose: handleNoteTypeRefresh,
			}),
		[plugin, handleNoteTypeRefresh],
	);
	const handleChangeType = useCallback(async () => {
		if (!noteType || !editMode?.noteId) return;

		const { ChangeNoteTypeModal } = await import(
			"@true-recall/obsidian/modals/library/ChangeNoteTypeModal"
		);
		const allNoteTypes = plugin.cardStore.noteTypes.getAll();

		const modal = new ChangeNoteTypeModal(app, {
			currentNoteType: noteType,
			availableNoteTypes: allNoteTypes,
			noteCount: 1,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
			return;

		plugin.flashcardManager.changeNoteType(
			editMode.noteId,
			result.targetNoteTypeId,
			result.fieldMapping,
		);

		onDone({ cancelled: false });
	}, [noteType, app, plugin, editMode, onDone]);

	const resolveSourceUid = useCallback(async (): Promise<
		string | undefined
	> => {
		// Edit mode: keep existing sourceUid
		if (isEdit) return editMode?.note.sourceUid;

		// Add mode with pre-set sourceUid (from review card)
		if (addMode?.sourceUid) return addMode?.sourceUid;

		// Add mode with selected source note
		if (!selectedSourceNote || !plugin.flashcardManager) return undefined;
		const fmService = plugin.flashcardManager.getFrontmatterService();
		let uid = await fmService.getSourceNoteUid(selectedSourceNote.path);
		if (!uid) {
			uid = fmService.generateUid();
			await fmService.setSourceNoteUid(selectedSourceNote.path, uid);
		}
		return uid;
	}, [isEdit, editMode, addMode, selectedSourceNote, plugin.flashcardManager]);

	return {
		...state,
		app,
		plugin,
		isEdit,
		editMode,
		noteType,
		showSourcePicker,
		selectedSourceNote,
		sourceNoteFile,
		canSave,
		stateRef,
		revisionRef,
		dispatch,
		edit,
		rootRef,
		focusedFieldRef,
		userCommentInputRef,
		handleFieldFocus,
		handleFieldChange,
		handleNoteTypeChange,
		handleUserCommentChange,
		handleSourceSelect,
		handleTypeInToggle,
		togglePin,
		openFields,
		openCards,
		handleChangeType,
		resolveSourceUid,
		invalidatePendingCreateUndo,
	};
}
export type QuickNoteEditor = ReturnType<typeof useQuickNoteEditor>;
