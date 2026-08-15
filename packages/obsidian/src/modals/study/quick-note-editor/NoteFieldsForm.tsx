import type { EditorView } from "@codemirror/view";
import { useCallback, useRef } from "preact/hooks";

import type { NoteType } from "@true-recall/core/types/note.types";

import type { EmbeddableEditorInstance } from "@true-recall/obsidian/editor/shared/embedded-editor";

import { NoteField } from "./NoteField";

interface NoteFieldsFormProps {
	noteType: NoteType;
	fields: Record<string, string>;
	sourcePath: string;
	onFieldChange: (fieldName: string, value: string) => void;
	onFieldFocus?: (fieldName: string, editorView: EditorView) => void;
	onModEnter?: (fieldName: string, value: string) => void;
	onModUndo?: () => boolean;
	onUserEdit?: () => void;
	onEscape?: () => void;
	autoFocusFirst?: boolean;
	pinnedFields?: Set<string>;
	onTogglePin?: (fieldName: string) => void;
	focusFirstRequest?: number;
}

export function NoteFieldsForm({
	noteType,
	fields,
	sourcePath,
	onFieldChange,
	onFieldFocus,
	onModEnter,
	onModUndo,
	onUserEdit,
	onEscape,
	autoFocusFirst = true,
	pinnedFields,
	onTogglePin,
	focusFirstRequest = 0,
}: NoteFieldsFormProps) {
	const editorsRef = useRef(new Map<string, EmbeddableEditorInstance>());

	const registerEditor = useCallback(
		(name: string, editor: EmbeddableEditorInstance | null) => {
			if (editor) editorsRef.current.set(name, editor);
			else editorsRef.current.delete(name);
		},
		[],
	);

	const focusField = useCallback(
		(fieldName: string, direction: 1 | -1) => {
			const fieldNames = noteType.fields;
			const nextField = fieldNames[fieldNames.indexOf(fieldName) + direction];
			if (nextField) editorsRef.current.get(nextField)?.cm.focus();
		},
		[noteType.fields],
	);

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			{noteType.fields.map((fieldName, index) => (
				<NoteField
					key={fieldName}
					fieldName={fieldName}
					content={fields[fieldName] ?? ""}
					sourcePath={sourcePath}
					autoFocus={autoFocusFirst && index === 0}
					onFieldChange={onFieldChange}
					onFieldFocus={onFieldFocus}
					onModEnter={onModEnter}
					onModUndo={onModUndo}
					onUserEdit={onUserEdit}
					onEscape={onEscape}
					isPinned={pinnedFields?.has(fieldName) ?? false}
					onTogglePin={onTogglePin}
					registerEditor={registerEditor}
					onTab={() => focusField(fieldName, 1)}
					onShiftTab={() => focusField(fieldName, -1)}
					focusRequest={index === 0 ? focusFirstRequest : 0}
				/>
			))}

			{noteType.type === 1 && (
				<div class="ep:text-ui-smaller ep:text-obs-faint ep:bg-obs-secondary ep:px-3 ep:py-2 ep:border ep:border-obs-border ep:rounded-md">
					Use <code class="ep:text-obs-accent">{"{{c1::text}}"}</code> syntax
					for cloze deletions. Multiple indices create multiple cards.
				</div>
			)}
		</div>
	);
}
