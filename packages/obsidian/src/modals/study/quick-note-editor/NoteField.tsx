import { StateEffect, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import type { EmbeddableEditorInstance } from "@true-recall/obsidian/editor/shared/embedded-editor";
import { formattingKeymap } from "@true-recall/obsidian/editor/shared/formatting/formatting-keymap";
import { getInkEmbeddableEditorExtensions } from "@true-recall/obsidian/editor/shared/ink-embeddable-editor";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";

interface NoteFieldProps {
	fieldName: string;
	content: string;
	sourcePath: string;
	autoFocus?: boolean;
	onFieldChange: (fieldName: string, value: string) => void;
	onFieldFocus?: (fieldName: string, editorView: EditorView) => void;
	onModEnter?: (fieldName: string, value: string) => void;
	onModUndo?: () => boolean;
	onUserEdit?: () => void;
	onEscape?: () => void;
	isPinned: boolean;
	onTogglePin?: (fieldName: string) => void;
	registerEditor?: (
		name: string,
		editor: EmbeddableEditorInstance | null,
	) => void;
	onTab?: () => void;
	onShiftTab?: () => void;
	focusRequest?: number;
}

export function NoteField({
	fieldName,
	content,
	sourcePath,
	autoFocus,
	onFieldChange,
	onFieldFocus,
	onModEnter,
	onModUndo,
	onUserEdit,
	onEscape,
	isPinned,
	onTogglePin,
	registerEditor,
	onTab,
	onShiftTab,
	focusRequest = 0,
}: NoteFieldProps) {
	const app = useApp();
	const plugin = usePlugin();
	const containerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const shouldFocusRef = useRef(false);
	const pinIconRef = useIcon("pin");

	const contentRef = useRef(content);
	contentRef.current = content;

	const handleBlur = useCallback(
		(editor: EmbeddableEditorInstance) =>
			onFieldChange(fieldName, editor.value),
		[fieldName, onFieldChange],
	);

	const handleModEnter = useCallback(
		(editor: EmbeddableEditorInstance) => onModEnter?.(fieldName, editor.value),
		[fieldName, onModEnter],
	);

	const debounceRef = useRef<number>();
	// True while a typed change is waiting for its debounced commit. Guards
	// the push-back effect below: syncing the parent's (stale) content into
	// the editor during that window would erase what was just typed.
	const hasPendingCommitRef = useRef(false);
	const onFieldChangeRef = useRef(onFieldChange);
	onFieldChangeRef.current = onFieldChange;
	const onModUndoRef = useRef(onModUndo);
	onModUndoRef.current = onModUndo;
	const onUserEditRef = useRef(onUserEdit);
	onUserEditRef.current = onUserEdit;

	const [editorFailed, setEditorFailed] = useState(false);

	useEffect(() => {
		const el = containerRef.current;
		if (!el || !plugin.EmbeddableEditor || isCollapsed) return;

		let editor: EmbeddableEditorInstance;
		try {
			editor = new plugin.EmbeddableEditor(app, el, {
				value: contentRef.current,
				onBlur: handleBlur,
				onEscape: () => onEscape?.(),
				onModEnter: handleModEnter,
				onModUndo: () => onModUndoRef.current?.() ?? false,
				onTab: onTab
					? () => {
							onTab();
							return true;
						}
					: undefined,
				onShiftTab: onShiftTab
					? () => {
							onShiftTab();
							return true;
						}
					: undefined,
				extraExtensions: getInkEmbeddableEditorExtensions(app, sourcePath),
			});
		} catch (error) {
			console.error("[NoteField] Failed to create editor:", error);
			setEditorFailed(true);
			return;
		}
		editorRef.current = editor;
		registerEditor?.(fieldName, editor);

		editor.cm.dispatch({
			effects: StateEffect.appendConfig.of([
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						if (
							update.transactions.some(
								(transaction) =>
									transaction.annotation(Transaction.userEvent) !== undefined,
							)
						) {
							onUserEditRef.current?.();
						}
						window.clearTimeout(debounceRef.current);
						hasPendingCommitRef.current = true;
						debounceRef.current = window.setTimeout(() => {
							hasPendingCommitRef.current = false;
							onFieldChangeRef.current(fieldName, update.state.doc.toString());
						}, 150);
					}
				}),
				formattingKeymap(),
			]),
		});

		editor.cm.contentDOM.addEventListener("focusin", () => {
			onFieldFocus?.(fieldName, editor.cm);
		});

		if (autoFocus || shouldFocusRef.current) {
			shouldFocusRef.current = false;
			const endPos = editor.cm.state.doc.length;
			editor.cm.dispatch({ selection: { anchor: endPos } });
			editor.cm.focus();
		}

		return () => {
			window.clearTimeout(debounceRef.current);
			hasPendingCommitRef.current = false;
			registerEditor?.(fieldName, null);
			editorRef.current = null;
			editor.destroy();
		};
	}, [app, plugin.EmbeddableEditor, isCollapsed, sourcePath]); // eslint-disable-line react-hooks/exhaustive-deps -- callbacks use refs; recreate only when editor context changes

	useLayoutEffect(() => {
		const editor = editorRef.current;
		if (!editor || editor.value === content) return;
		if (hasPendingCommitRef.current) return;
		editor.set(content);
	}, [content]);

	useEffect(() => {
		if (focusRequest === 0) return;

		const editor = editorRef.current;
		if (editor) {
			editor.cm.focus();
			return;
		}

		textareaRef.current?.focus();
	}, [focusRequest]);

	const header = (
		<Clickable
			class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-secondary ep:cursor-pointer ep:select-none ep:group"
			onClick={() => {
				setIsCollapsed((value) => {
					if (value) shouldFocusRef.current = true;
					return !value;
				});
			}}
		>
			<span class="ep:text-obs-faint ep:text-ui-smaller ep:w-3 ep:shrink-0">
				{isCollapsed ? "▸" : "▾"}
			</span>
			<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal ep:flex-1">
				{fieldName}
			</span>
			{onTogglePin && (
				<Clickable
					ref={pinIconRef}
					title={
						isPinned
							? "Unpin field (content kept on Save & Add)"
							: "Pin field (keep content on Save & Add)"
					}
					class={`ep:w-4 ep:h-4 ep:cursor-pointer ep:transition-colors ep:[&>svg]:w-3.5 ep:[&>svg]:h-3.5 ${
						isPinned
							? "ep:text-obs-accent"
							: "ep:text-obs-faint ep:opacity-50 ep:hover:opacity-100"
					}`}
					onClick={(event: MouseEvent) => {
						event.stopPropagation();
						onTogglePin(fieldName);
					}}
				/>
			)}
		</Clickable>
	);

	if (!plugin.EmbeddableEditor || editorFailed) {
		return (
			<div class="true-recall-add-field-row ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden">
				{header}
				{!isCollapsed && (
					<textarea
						ref={textareaRef}
						class="ep:w-full ep:px-3 ep:py-2 ep:text-ui-small ep:bg-obs-primary ep:min-h-[2.25rem] ep:resize-y"
						value={content}
						onInput={(event) =>
							onFieldChange(
								fieldName,
								(event.target as HTMLTextAreaElement).value,
							)
						}
						onKeyDown={(event) => {
							if (
								!event.shiftKey &&
								(event.metaKey || event.ctrlKey) &&
								event.key.toLowerCase() === "z" &&
								onModUndo?.()
							) {
								event.preventDefault();
								event.stopPropagation();
								return;
							}
							if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
								event.preventDefault();
								event.stopPropagation();
								onModEnter?.(fieldName, event.currentTarget.value);
							}
						}}
						onBeforeInput={() => onUserEdit?.()}
					/>
				)}
			</div>
		);
	}

	return (
		<div class="ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden">
			{header}
			{!isCollapsed && (
				<div
					ref={containerRef}
					class="true-recall-add-field ep:w-full ep:min-h-[1.6em] ep:bg-obs-primary ep:overflow-hidden ep:px-3 ep:py-2"
				/>
			)}
		</div>
	);
}
