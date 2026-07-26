import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { EmbeddableEditorInstance } from "@true-recall/obsidian/editor/shared/embedded-editor";
import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";

import { createDebouncedCommit } from "./debounced-commit";

/** Matches the card editor's own fields. Consumers of this editor persist on
 * change, so reporting every keystroke made typing unusable. */
const CHANGE_DEBOUNCE_MS = 150;

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

	const changes = useMemo(
		() =>
			createDebouncedCommit<string>(
				(next) => onChangeRef.current?.(next),
				CHANGE_DEBOUNCE_MS,
			),
		[],
	);

	useEffect(() => () => changes.flush(), [changes]);

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
					: (update) => changes.push(update.state.doc.toString()),
				onBlur: readOnly ? undefined : () => changes.flush(),
				extraExtensions: extras,
			});
		} catch (err) {
			console.error("[CardAIFieldEditor] failed to create editor:", err);
			setEditorFailed(true);
			return;
		}
		editorRef.current = editor;

		return () => {
			changes.flush();
			editorRef.current = null;
			editor.destroy();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- editor recreates only when host swaps; value/readOnly handled separately
	}, [app, plugin.EmbeddableEditor, readOnly]);

	useEffect(() => {
		const editor = editorRef.current;
		if (!editor || editor.value === value) return;
		// A debounced keystroke has not reached the host yet, so `value` is one
		// edit behind the document — pushing it back would undo what was typed.
		if (changes.hasPending()) return;
		editor.set(value);
	}, [value, changes]);

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
				onInput={(e) => changes.push((e.target as HTMLTextAreaElement).value)}
				onBlur={() => changes.flush()}
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
