import type { EditorView } from "@codemirror/view";
import type { EmbeddableEditorInstance } from "@shared/ui/editor/embedded-editor";
import { useApp, usePlugin } from "@shared/ui/preact/ObsidianContext";
import type { NoteType } from "@shared/types/note.types";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "preact/hooks";

// ── Formatting helpers ────────────────────────────────────────────────────

function toggleMarker(view: EditorView, marker: string) {
	const { from, to } = view.state.selection.main;
	const selected = view.state.sliceDoc(from, to);
	const mLen = marker.length;
	if (
		selected.startsWith(marker) &&
		selected.endsWith(marker) &&
		selected.length > mLen * 2
	) {
		view.dispatch({ changes: { from, to, insert: selected.slice(mLen, -mLen) } });
	} else {
		view.dispatch({
			changes: { from, to, insert: `${marker}${selected}${marker}` },
			selection: { anchor: from + mLen, head: to + mLen },
		});
	}
	view.focus();
}

// ── NoteFieldsForm ────────────────────────────────────────────────────────

interface NoteFieldsFormProps {
	noteType: NoteType;
	fields: Record<string, string>;
	onFieldChange: (fieldName: string, value: string) => void;
	onModEnter?: () => void;
	autoFocusFirst?: boolean;
}

export function NoteFieldsForm({
	noteType,
	fields,
	onFieldChange,
	onModEnter,
	autoFocusFirst = true,
}: NoteFieldsFormProps) {
	return (
		<div class="ep:divide-y ep:divide-obs-divider ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden">
			{noteType.fields.map((fieldName, idx) => (
				<CMField
					key={fieldName}
					fieldName={fieldName}
					content={fields[fieldName] ?? ""}
					autoFocus={autoFocusFirst && idx === 0}
					onFieldChange={onFieldChange}
					onModEnter={onModEnter}
				/>
			))}

			{noteType.type === 1 && (
				<div class="ep:text-ui-smaller ep:text-obs-faint ep:bg-obs-secondary ep:px-3 ep:py-2">
					Use{" "}
					<code class="ep:text-obs-accent">{"{{c1::text}}"}</code>{" "}
					syntax for cloze deletions. Multiple indices create
					multiple cards.
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
	onModEnter?: () => void;
}

function CMField({
	fieldName,
	content,
	autoFocus,
	onFieldChange,
	onModEnter,
}: CMFieldProps) {
	const app = useApp();
	const plugin = usePlugin();
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const [isCollapsed, setIsCollapsed] = useState(false);

	// Track current content for blur handler without triggering editor recreation
	const contentRef = useRef(content);
	contentRef.current = content;

	const handleBlur = useCallback(
		(e: EmbeddableEditorInstance) => onFieldChange(fieldName, e.value),
		[fieldName, onFieldChange],
	);

	const handleModEnter = useCallback(() => onModEnter?.(), [onModEnter]);

	// Create editor on mount, destroy on unmount.
	// Stable deps — editor is only recreated if app or EmbeddableEditor class changes.
	useEffect(() => {
		const el = containerRef.current;
		if (!el || !plugin.EmbeddableEditor) return;

		let editor: EmbeddableEditorInstance;
		try {
			editor = new plugin.EmbeddableEditor(app, el, {
				value: contentRef.current,
				onBlur: handleBlur,
				onEscape: (e) => e.cm.contentDOM.blur(),
				onModEnter: handleModEnter,
			});
		} catch (err) {
			console.error("[CMField] Failed to create editor:", err);
			return;
		}

		editorRef.current = editor;
		if (autoFocus) editor.cm.focus();

		return () => {
			editorRef.current = null;
			editor.destroy();
		};
	}, [app, plugin.EmbeddableEditor]); // eslint-disable-line react-hooks/exhaustive-deps

	// Sync content when parent updates fields (e.g. NoteType switch resets values).
	// useLayoutEffect prevents a visible flash of stale content.
	useLayoutEffect(() => {
		const editor = editorRef.current;
		if (!editor || editor.value === content) return;
		editor.set(content);
	}, [content]);

	const fmtBtn = (label: string, marker: string, title: string) => (
		<div
			role="button"
			title={title}
			class="ep:px-1.5 ep:py-0.5 ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-tertiary ep:rounded ep:cursor-pointer ep:select-none ep:leading-tight"
			onMouseDown={(e: MouseEvent) => {
				e.preventDefault();
				const editor = editorRef.current;
				if (editor) toggleMarker(editor.cm, marker);
			}}
		>
			{label}
		</div>
	);

	const header = (
		<div
			class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-secondary ep:cursor-pointer ep:select-none ep:group"
			onClick={() => setIsCollapsed((v) => !v)}
		>
			<span class="ep:text-obs-faint ep:text-ui-smaller ep:w-3 ep:shrink-0">
				{isCollapsed ? "▸" : "▾"}
			</span>
			<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal ep:flex-1">
				{fieldName}
			</span>
			{/* Formatting toolbar — stop click from toggling collapse */}
			<div
				class="ep:flex ep:items-center ep:gap-0.5"
				onClick={(e: MouseEvent) => e.stopPropagation()}
			>
				{fmtBtn("B", "**", "Bold")}
				{fmtBtn("I", "*", "Italic")}
				{fmtBtn("U", "__", "Underline")}
				{fmtBtn("`", "`", "Inline code")}
			</div>
		</div>
	);

	// Fallback: render plain textarea until EmbeddableEditor is available
	// (class is lazy-loaded on onLayoutReady — practically instant, but guard anyway)
	if (!plugin.EmbeddableEditor) {
		return (
			<div>
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
		<div>
			{header}
			{!isCollapsed && (
				<div
					ref={containerRef}
					class="ep:w-full ep:min-h-[2.25rem] ep:bg-obs-primary ep:overflow-hidden"
				/>
			)}
		</div>
	);
}
