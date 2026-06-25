import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "preact/hooks";

import type { EmbeddableEditorInstance } from "@true-recall/obsidian/editor/shared/embedded-editor";
import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";

interface CardAIFieldEditorProps {
	value: string;
	onChange?: (next: string) => void;
	readOnly?: boolean;
	ariaLabel?: string;
}

export function CardAIFieldEditor({
	value,
	onChange,
	readOnly = false,
	ariaLabel,
}: CardAIFieldEditorProps) {
	const app = useApp();
	const plugin = usePlugin();
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const [editorFailed, setEditorFailed] = useState(false);

	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		const el = containerRef.current;
		if (!el || !plugin.EmbeddableEditor) return;

		const extras = readOnly
			? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
			: [];

		let editor: EmbeddableEditorInstance;
		try {
			editor = new plugin.EmbeddableEditor(app, el, {
				value,
				onChange: readOnly
					? undefined
					: (update) => onChangeRef.current?.(update.state.doc.toString()),
				extraExtensions: extras,
			});
		} catch (err) {
			console.error("[CardAIFieldEditor] failed to create editor:", err);
			setEditorFailed(true);
			return;
		}
		editorRef.current = editor;

		return () => {
			editorRef.current = null;
			editor.destroy();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- editor recreates only when host swaps; value/readOnly handled separately
	}, [app, plugin.EmbeddableEditor, readOnly]);

	useEffect(() => {
		const editor = editorRef.current;
		if (!editor || editor.value === value) return;
		editor.set(value);
	}, [value]);

	if (!plugin.EmbeddableEditor || editorFailed) {
		if (readOnly) {
			return (
				<pre class="tr-card-ai-fallback-pre" title={ariaLabel}>
					{value}
				</pre>
			);
		}
		return (
			<textarea
				class="tr-card-ai-fallback-textarea"
				value={value}
				aria-label={ariaLabel}
				onInput={(e) => onChange?.((e.target as HTMLTextAreaElement).value)}
			/>
		);
	}

	return (
		<div
			ref={containerRef}
			class={`tr-card-ai-field-editor${readOnly ? " is-readonly" : ""}`}
			title={ariaLabel}
		/>
	);
}
