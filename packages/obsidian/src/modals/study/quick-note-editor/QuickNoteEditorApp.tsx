import { FormattingToolbar } from "@true-recall/obsidian/editor/shared/formatting";
import { useKeyboardInset } from "@true-recall/obsidian/preact/useKeyboardInset";

import { ActionBar } from "./ActionBar";
import { QuickNoteFooter } from "./components/QuickNoteFooter";
import { useQuickNoteAI } from "./hooks/useQuickNoteAI";
import { useQuickNoteEditor } from "./hooks/useQuickNoteEditor";
import { useQuickNotePersistence } from "./hooks/useQuickNotePersistence";
import { useQuickNoteShortcuts } from "./hooks/useQuickNoteShortcuts";
import { NoteFieldsForm } from "./NoteFieldsForm";
import type { QuickNoteEditorMode, QuickNoteEditorResult } from "./types";
import { UserCommentField } from "./UserCommentField";

interface QuickNoteEditorAppProps {
	mode: QuickNoteEditorMode;
	onDone: (result: QuickNoteEditorResult) => void;
	onRequestClose?: () => void;
	onDirtyChange?: (isDirty: boolean) => void;
}

export function QuickNoteEditorApp({
	mode,
	onDone,
	onRequestClose,
	onDirtyChange,
}: QuickNoteEditorAppProps) {
	useKeyboardInset();
	const editor = useQuickNoteEditor(mode, onDone, onDirtyChange);
	const {
		app,
		noteType,
		noteTypeId,
		isEdit,
		showSourcePicker,
		selectedSourceNote,
		handleSourceSelect,
		handleNoteTypeChange,
		handleChangeType,
		focusedFieldRef,
		alwaysTypeIn,
		handleTypeInToggle,
		fields,
		sourceNoteFile,
		handleFieldChange,
		handleFieldFocus,
		invalidatePendingCreateUndo,
		pinnedFields,
		togglePin,
		focusFirstRequest,
		userComment,
		handleUserCommentChange,
		userCommentInputRef,
		canSave,
		openFields,
		openCards,
		rootRef,
	} = editor;
	const { saving, handleSave, handleSaveAndClose, handleUndoLastCreate } =
		useQuickNotePersistence(editor, onDone);
	const { aiDisabled, aiTitle, openAI } = useQuickNoteAI(editor);
	useQuickNoteShortcuts(editor, handleSave, handleUndoLastCreate);
	if (!noteType) {
		return (
			<div class="ep:text-obs-muted ep:text-center ep:py-8">
				Loading note types...
			</div>
		);
	}

	return (
		<div
			ref={rootRef}
			class="true-recall-quick-editor ep:flex ep:flex-col ep:gap-3"
		>
			{/* Action bar: Note type, Source note, AI */}
			<ActionBar
				app={app}
				noteTypeId={noteTypeId}
				onNoteTypeChange={handleNoteTypeChange}
				isEdit={isEdit}
				onChangeType={isEdit ? () => void handleChangeType() : undefined}
				showSourcePicker={showSourcePicker}
				selectedSourceNote={selectedSourceNote}
				onSourceSelect={handleSourceSelect}
			/>

			{/* Shared formatting toolbar */}
			<FormattingToolbar
				app={app}
				getEditorView={() => focusedFieldRef.current?.editorView ?? null}
				typeInEnabled={alwaysTypeIn}
				onTypeInToggle={!isEdit ? handleTypeInToggle : undefined}
				showCloze={noteType.type === 1}
			/>

			{/* Dynamic fields */}
			<NoteFieldsForm
				noteType={noteType}
				fields={fields}
				sourcePath={sourceNoteFile?.path ?? ""}
				onFieldChange={handleFieldChange}
				onFieldFocus={handleFieldFocus}
				onModEnter={(fieldName, value) => {
					handleFieldChange(fieldName, value);
					void handleSave();
				}}
				onModUndo={handleUndoLastCreate}
				onUserEdit={invalidatePendingCreateUndo}
				onEscape={onRequestClose}
				pinnedFields={pinnedFields}
				onTogglePin={togglePin}
				focusFirstRequest={focusFirstRequest}
			/>

			<UserCommentField
				value={userComment}
				onChange={handleUserCommentChange}
				inputRef={userCommentInputRef}
			/>

			{/* Footer */}
			<QuickNoteFooter
				app={app}
				isEdit={isEdit}
				canSave={canSave}
				saving={saving}
				requiresSourceNote={showSourcePicker && !selectedSourceNote}
				sourceNoteFile={sourceNoteFile}
				onSave={() => void handleSave()}
				onSaveAndClose={() => void handleSaveAndClose()}
				onOpenFields={openFields}
				onOpenCards={openCards}
				onAI={openAI}
				aiDisabled={aiDisabled}
				aiTitle={aiTitle}
			/>
		</div>
	);
}
