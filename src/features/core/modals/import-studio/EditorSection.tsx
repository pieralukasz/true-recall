import { Compartment } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { placeholder } from "@codemirror/view";
import type { NoteType } from "@shared/types/note.types";
import type { EmbeddableEditorInstance } from "@shared/ui/editor/embedded-editor";
import { usePlugin } from "@shared/ui/preact/ObsidianContext";
import type { App } from "obsidian";
import { useCallback, useEffect, useRef } from "preact/hooks";
import { buildPlaceholder } from "./placeholder";

interface EditorSectionProps {
	app: App;
	noteType: NoteType | null;
	text: string;
	onTextChange: (value: string) => void;
	onEditorReady: (editor: EmbeddableEditorInstance | null) => void;
	onEditorFocus: (editorView: EditorView) => void;
	onModEnter: () => void;
}

export function EditorSection({
	app,
	noteType,
	text,
	onTextChange,
	onEditorReady,
	onEditorFocus,
	onModEnter,
}: EditorSectionProps) {
	const plugin = usePlugin();
	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const placeholderCompartment = useRef(new Compartment()).current;
	const onTextChangeRef = useRef(onTextChange);
	const onEditorReadyRef = useRef(onEditorReady);
	const onEditorFocusRef = useRef(onEditorFocus);
	const onModEnterRef = useRef(onModEnter);
	const noteTypeRef = useRef(noteType);

	onTextChangeRef.current = onTextChange;
	onEditorReadyRef.current = onEditorReady;
	onEditorFocusRef.current = onEditorFocus;
	onModEnterRef.current = onModEnter;
	noteTypeRef.current = noteType;

	useEffect(() => {
		const el = editorContainerRef.current;
		if (!el || !plugin.EmbeddableEditor) return;

		let editor: EmbeddableEditorInstance;
		try {
			editor = new plugin.EmbeddableEditor(app, el, {
				onChange: (update) =>
					onTextChangeRef.current(update.state.doc.toString()),
				onModEnter: () => onModEnterRef.current(),
				extraExtensions: [
					placeholderCompartment.of(
						placeholder(buildPlaceholder(noteTypeRef.current)),
					),
				],
			});
		} catch (err) {
			console.error("[ImportStudioApp] Failed to create editor:", err);
			return;
		}

		editorRef.current = editor;
		onEditorReadyRef.current(editor);
		onEditorFocusRef.current(editor.cm);
		const onFocusIn = () => {
			onEditorFocusRef.current(editor.cm);
		};
		editor.cm.contentDOM.addEventListener("focusin", onFocusIn);
		editor.cm.focus();

		return () => {
			editor.cm.contentDOM.removeEventListener("focusin", onFocusIn);
			editorRef.current = null;
			onEditorReadyRef.current(null);
			editor.destroy();
		};
	}, [app, placeholderCompartment, plugin.EmbeddableEditor]);

	useEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;
		editor.cm.dispatch({
			effects: placeholderCompartment.reconfigure(
				placeholder(buildPlaceholder(noteType)),
			),
		});
	}, [noteType, placeholderCompartment]);

	if (!plugin.EmbeddableEditor) {
		return (
			<textarea
				class="ep:w-full ep:min-h-[400px] ep:px-3 ep:py-2 ep:text-ui-small ep:font-mono ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:resize-y ep:placeholder-obs-faint"
				placeholder={buildPlaceholder(noteType)}
				value={text}
				onInput={(e) => onTextChange((e.target as HTMLTextAreaElement).value)}
				onKeyDown={(e) => {
					if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
						e.preventDefault();
						onModEnter();
					}
				}}
			/>
		);
	}

	const handleContainerClick = useCallback(
		(e: MouseEvent) => {
			const editor = editorRef.current;
			if (!editor) return;
			// Focus CM when clicking in the empty scroller area below content
			const target = e.target as HTMLElement;
			if (!target.closest(".cm-content")) {
				editor.cm.focus();
			}
		},
		[],
	);

	return (
		<div
			ref={editorContainerRef}
			onClick={handleContainerClick}
			class="true-recall-import-editor ep:w-full ep:min-h-[400px] ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden"
		/>
	);
}
