import type { EmbeddableEditorInstance } from "@shared/ui/editor/embedded-editor";
import {
	useApp,
	usePlugin,
} from "@shared/ui/preact/ObsidianContext";
import { stripBrTags } from "@shared/utils";
import { useCallback, useEffect, useRef } from "preact/hooks";

export interface LivePreviewFieldProps {
	content: string;
	field: "question" | "answer";
	sourcePath: string;
	cls: string;
	onContentChange?: (
		value: string,
		field: "question" | "answer",
	) => void;
}

export function LivePreviewField({
	content,
	field,
	sourcePath,
	cls,
	onContentChange,
}: LivePreviewFieldProps) {
	const app = useApp();
	const plugin = usePlugin();
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const contentRef = useRef(content);

	// Keep track of current content prop for blur handler
	contentRef.current = content;

	const handleBlur = useCallback(
		(editor: EmbeddableEditorInstance) => {
			const currentValue = editor.value;
			const normalizedOriginal = stripBrTags(contentRef.current);
			if (currentValue !== normalizedOriginal && onContentChange) {
				onContentChange(currentValue, field);
			}
		},
		[field, onContentChange],
	);

	const handleEscape = useCallback(
		(editor: EmbeddableEditorInstance) => {
			// Blur the editor so keyboard shortcuts resume
			editor.cm.contentDOM.blur();
		},
		[],
	);

	// Create editor on mount, destroy on unmount
	useEffect(() => {
		const el = containerRef.current;
		if (!el || !plugin.EmbeddableEditor) return;

		const normalizedContent = stripBrTags(content);

		const editor = new plugin.EmbeddableEditor(app, el, {
			value: normalizedContent,
			onBlur: handleBlur,
			onEscape: handleEscape,
		});

		editorRef.current = editor;

		return () => {
			editorRef.current = null;
			editor.destroy();
		};
	}, [app, plugin.EmbeddableEditor]);

	// Update editor content when card changes (new card appears)
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;

		const normalizedContent = stripBrTags(content);
		// Only update if content actually differs (avoid overwriting in-progress edits)
		if (editor.value !== normalizedContent) {
			editor.set(normalizedContent);
		}
	}, [content]);

	return (
		<div
			ref={containerRef}
			class={cls}
			data-field={field}
			data-source-path={sourcePath}
		/>
	);
}
