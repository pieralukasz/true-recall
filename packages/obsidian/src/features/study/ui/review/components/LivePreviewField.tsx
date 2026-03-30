import type { EmbeddableEditorInstance } from "@true-recall/obsidian/editor/shared/embedded-editor";
import { useApp, usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { stripBrTags } from "@true-recall/core/utils";
import { useCallback, useEffect, useLayoutEffect, useRef } from "preact/hooks";

const AUTOSAVE_DELAY_MS = 1500;

export interface LivePreviewFieldProps {
	content: string;
	field: "question" | "answer";
	sourcePath: string;
	cls: string;
	onContentChange?: (value: string, field: "question" | "answer") => void;
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

	// Refs so stale closures (editor callbacks captured at construction) always access latest values
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onContentChangeRef = useRef(onContentChange);
	const fieldRef = useRef(field);

	contentRef.current = content;
	onContentChangeRef.current = onContentChange;
	fieldRef.current = field;

	const performSave = useCallback(() => {
		const editor = editorRef.current;
		if (!editor) return;
		const currentValue = editor.value;
		const normalizedOriginal = stripBrTags(contentRef.current);
		if (currentValue !== normalizedOriginal && onContentChangeRef.current) {
			onContentChangeRef.current(currentValue, fieldRef.current);
			contentRef.current = currentValue;
		}
	}, []);

	const flushPendingSave = useCallback(() => {
		if (saveTimerRef.current !== null) {
			clearTimeout(saveTimerRef.current);
			saveTimerRef.current = null;
		}
		performSave();
	}, [performSave]);

	const scheduleSave = useCallback(() => {
		if (saveTimerRef.current !== null) {
			clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = setTimeout(() => {
			saveTimerRef.current = null;
			performSave();
		}, AUTOSAVE_DELAY_MS);
	}, [performSave]);

	const handleBlur = useCallback(
		(_editor: EmbeddableEditorInstance) => {
			flushPendingSave();
		},
		[flushPendingSave],
	);

	const handleEscape = useCallback((editor: EmbeddableEditorInstance) => {
		editor.cm.contentDOM.blur();
	}, []);

	const handleChange = useCallback(() => {
		scheduleSave();
	}, [scheduleSave]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el || !plugin.EmbeddableEditor) return;

		const normalizedContent = stripBrTags(content);

		let editor: import("@true-recall/obsidian/editor/shared/embedded-editor").EmbeddableEditorInstance;
		try {
			editor = new plugin.EmbeddableEditor(app, el, {
				value: normalizedContent,
				onBlur: handleBlur,
				onEscape: handleEscape,
				onChange: handleChange,
			});
			editorRef.current = editor;
		} catch (error) {
			console.error("[LivePreviewField] Failed to create editor:", error);
			return;
		}

		// On macOS (Electron), clicking a <div tabIndex="0"> does NOT move focus,
		// so the CM6 blur event never fires when clicking rating buttons.
		// A document-level mousedown listener fires BEFORE the click handler
		// and before any card transition, ensuring edits are saved on all platforms.
		const handleOutsideMouseDown = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				flushPendingSave();
			}
		};
		document.addEventListener("mousedown", handleOutsideMouseDown);

		return () => {
			flushPendingSave();
			document.removeEventListener("mousedown", handleOutsideMouseDown);
			editorRef.current = null;
			editor.destroy();
		};
	}, [app, plugin.EmbeddableEditor]);

	// Update editor content when card changes (new card appears)
	// useLayoutEffect ensures CM content updates before paint — no flash of old card
	useLayoutEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;

		const normalizedContent = stripBrTags(content);
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
