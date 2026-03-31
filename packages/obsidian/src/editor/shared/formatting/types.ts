import type { EditorView } from "@codemirror/view";

export interface FormattingTargetRef {
	editorView: EditorView;
	fieldName?: string;
}

export type GetFormattingEditorView = () => EditorView | null;
