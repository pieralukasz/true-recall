import { StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "preact/hooks";

import type { NoteType } from "@true-recall/core/types/note.types";

import { Clickable } from "@true-recall/obsidian/components";
import type { EmbeddableEditorInstance } from "@true-recall/obsidian/editor/shared/embedded-editor";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";

// ── NoteFieldsForm ────────────────────────────────────────────────────────

interface NoteFieldsFormProps {
	noteType: NoteType;
	fields: Record<string, string>;
	onFieldChange: (fieldName: string, value: string) => void;
	onFieldFocus?: (fieldName: string, editorView: EditorView) => void;
	onModEnter?: () => void;
	onEscape?: () => void;
	autoFocusFirst?: boolean;
	pinnedFields?: Set<string>;
	onTogglePin?: (fieldName: string) => void;
}

export function NoteFieldsForm({
	noteType,
	fields,
	onFieldChange,
	onFieldFocus,
	onModEnter,
	onEscape,
	autoFocusFirst = true,
	pinnedFields,
	onTogglePin,
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
			const idx = fieldNames.indexOf(fieldName);
			const nextIdx = idx + direction;
			if (nextIdx >= 0 && nextIdx < fieldNames.length) {
				const nextField = fieldNames[nextIdx];
				if (nextField) {
					const nextEditor = editorsRef.current.get(nextField);
					nextEditor?.cm.focus();
				}
			}
		},
		[noteType.fields],
	);

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			{noteType.fields.map((fieldName, idx) => (
				<CMField
					key={fieldName}
					fieldName={fieldName}
					content={fields[fieldName] ?? ""}
					autoFocus={autoFocusFirst && idx === 0}
					onFieldChange={onFieldChange}
					onFieldFocus={onFieldFocus}
					onModEnter={onModEnter}
					onEscape={onEscape}
					isPinned={pinnedFields?.has(fieldName) ?? false}
					onTogglePin={onTogglePin}
					registerEditor={registerEditor}
					onTab={() => focusField(fieldName, 1)}
					onShiftTab={() => focusField(fieldName, -1)}
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

// ── CMField ───────────────────────────────────────────────────────────────

interface CMFieldProps {
	fieldName: string;
	content: string;
	autoFocus?: boolean;
	onFieldChange: (fieldName: string, value: string) => void;
	onFieldFocus?: (fieldName: string, editorView: EditorView) => void;
	onModEnter?: () => void;
	onEscape?: () => void;
	isPinned: boolean;
	onTogglePin?: (fieldName: string) => void;
	registerEditor?: (
		name: string,
		editor: EmbeddableEditorInstance | null,
	) => void;
	onTab?: () => void;
	onShiftTab?: () => void;
}

function CMField({
	fieldName,
	content,
	autoFocus,
	onFieldChange,
	onFieldFocus,
	onModEnter,
	onEscape,
	isPinned,
	onTogglePin,
	registerEditor,
	onTab,
	onShiftTab,
}: CMFieldProps) {
	const app = useApp();
	const plugin = usePlugin();
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const shouldFocusRef = useRef(false);
	const pinIconRef = useIcon("pin");

	// Track current content for blur handler without triggering editor recreation
	const contentRef = useRef(content);
	contentRef.current = content;

	const handleBlur = useCallback(
		(e: EmbeddableEditorInstance) => onFieldChange(fieldName, e.value),
		[fieldName, onFieldChange],
	);

	const handleModEnter = useCallback(() => onModEnter?.(), [onModEnter]);

	// Debounced doc-change listener — updates fields state as user types (~150ms)
	// so hasContent / Save button react without waiting for blur.
	// Added via StateEffect.appendConfig (after construction) because
	// EmbeddableEditor.onChange has a timing bug in buildLocalExtensions.
	const debounceRef = useRef<ReturnType<typeof setTimeout>>();
	const onFieldChangeRef = useRef(onFieldChange);
	onFieldChangeRef.current = onFieldChange;

	const [editorFailed, setEditorFailed] = useState(false);

	// Stable deps — editor is only recreated if app or EmbeddableEditor class changes.
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
			});
		} catch (err) {
			console.error("[CMField] Failed to create editor:", err);
			setEditorFailed(true);
			return;
		}
		editorRef.current = editor;
		registerEditor?.(fieldName, editor);

		// CM6 updateListener — catches all doc changes (type, delete, paste, undo)
		editor.cm.dispatch({
			effects: StateEffect.appendConfig.of(
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						clearTimeout(debounceRef.current);
						debounceRef.current = setTimeout(() => {
							onFieldChangeRef.current(fieldName, update.state.doc.toString());
						}, 150);
					}
				}),
			),
		});

		// Report focus to parent for shared toolbar
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
			clearTimeout(debounceRef.current);
			registerEditor?.(fieldName, null);
			editorRef.current = null;
			editor.destroy();
		};
	}, [app, plugin.EmbeddableEditor, isCollapsed]); // eslint-disable-line react-hooks/exhaustive-deps -- only recreate editor on mount, collapse toggle, or editor class change; value sync handled by separate effect

	// Sync content when parent updates fields (e.g. NoteType switch resets values).
	// useLayoutEffect prevents a visible flash of stale content.
	useLayoutEffect(() => {
		const editor = editorRef.current;
		if (!editor || editor.value === content) return;
		editor.set(content);
	}, [content]);

	const header = (
		<Clickable
			class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-secondary ep:cursor-pointer ep:select-none ep:group"
			onClick={() => {
				setIsCollapsed((v) => {
					if (v) shouldFocusRef.current = true;
					return !v;
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
					class={`ep:w-4 ep:h-4 ep:cursor-pointer ep:transition-colors [&>svg]:ep:w-3.5 [&>svg]:ep:h-3.5 ${
						isPinned
							? "ep:text-obs-accent"
							: "ep:text-obs-faint ep:opacity-50 ep:hover:opacity-100"
					}`}
					onClick={(e: MouseEvent) => {
						e.stopPropagation();
						onTogglePin(fieldName);
					}}
				/>
			)}
		</Clickable>
	);

	// Fallback: render plain textarea until EmbeddableEditor is available or if creation failed
	if (!plugin.EmbeddableEditor || editorFailed) {
		return (
			<div class="true-recall-add-field-row ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden">
				{header}
				{!isCollapsed && (
					<textarea
						class="ep:w-full ep:px-3 ep:py-2 ep:text-ui-small ep:bg-obs-primary ep:min-h-[2.25rem] ep:resize-y"
						value={content}
						onInput={(e) =>
							onFieldChange(fieldName, (e.target as HTMLTextAreaElement).value)
						}
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
