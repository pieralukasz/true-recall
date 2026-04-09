import { Compartment } from "@codemirror/state";
import { placeholder } from "@codemirror/view";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";

import type { EmbeddableEditorInstance } from "@true-recall/obsidian/editor/shared/embedded-editor";
import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";

interface TypeInCMEditorProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	placeholderText: string;
}

export function TypeInCMEditor({
	value,
	onChange,
	onSubmit,
	placeholderText,
}: TypeInCMEditorProps) {
	const app = useApp();
	const plugin = usePlugin();
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const placeholderCompartment = useRef(new Compartment()).current;
	const onChangeRef = useRef(onChange);
	const onSubmitRef = useRef(onSubmit);

	onChangeRef.current = onChange;
	onSubmitRef.current = onSubmit;

	useEffect(() => {
		const el = containerRef.current;
		if (!el || !plugin.EmbeddableEditor) return;

		let editor: EmbeddableEditorInstance;
		try {
			editor = new plugin.EmbeddableEditor(app, el, {
				value,
				onChange: (update) => onChangeRef.current(update.state.doc.toString()),
				onModEnter: () => onSubmitRef.current(),
				extraExtensions: [
					placeholderCompartment.of(placeholder(placeholderText)),
				],
			});
		} catch (error) {
			console.error("[TypeInCMEditor] Failed to create editor:", error);
			return;
		}

		editorRef.current = editor;

		// Auto-focus after the browser paints so the user can type immediately
		const rafId = requestAnimationFrame(() => editor.cm.focus());

		return () => {
			cancelAnimationFrame(rafId);
			editorRef.current = null;
			editor.destroy();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only recreate editor on mount or editor class change; value/placeholder sync handled by separate effects
	}, [app, plugin.EmbeddableEditor]);

	useLayoutEffect(() => {
		const editor = editorRef.current;
		if (!editor || editor.value === value) return;
		editor.set(value);
	}, [value]);

	useEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;
		editor.cm.dispatch({
			effects: placeholderCompartment.reconfigure(placeholder(placeholderText)),
		});
	}, [placeholderText, placeholderCompartment]);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	if (!plugin.EmbeddableEditor) {
		return (
			<textarea
				ref={textareaRef}
				class="ep:w-full ep:min-h-[1.6em] ep:px-3 ep:py-2 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:resize-y"
				value={value}
				placeholder={placeholderText}
				onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
				onKeyDown={(e) => {
					if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
						e.preventDefault();
						onSubmit();
					}
				}}
			/>
		);
	}

	return (
		<div
			ref={containerRef}
			class="true-recall-add-field ep:w-full ep:min-h-[1.6em] ep:bg-obs-primary ep:overflow-hidden ep:px-3 ep:py-2 ep:border ep:border-obs-border ep:rounded-md"
		/>
	);
}
