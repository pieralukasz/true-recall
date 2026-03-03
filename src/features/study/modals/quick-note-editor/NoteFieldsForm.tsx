import type { EmbeddableEditorInstance } from "@shared/ui/editor/embedded-editor";
import { useApp, usePlugin } from "@shared/ui/preact/ObsidianContext";
import type { NoteType } from "@shared/types/note.types";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
} from "preact/hooks";

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
		<div class="ep:space-y-3">
			{noteType.fields.map((fieldName, idx) => (
				<div key={fieldName}>
					<label class="ep:text-ui-smaller ep:text-obs-muted ep:mb-1 ep:block">
						{fieldName}:
					</label>
					<CMField
						fieldName={fieldName}
						content={fields[fieldName] ?? ""}
						autoFocus={autoFocusFirst && idx === 0}
						onFieldChange={onFieldChange}
						onModEnter={onModEnter}
					/>
				</div>
			))}

			{noteType.type === 1 && (
				<div class="ep:text-ui-smaller ep:text-obs-faint ep:bg-obs-secondary ep:px-3 ep:py-2 ep:rounded">
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

	// Fallback: render plain textarea until EmbeddableEditor is available
	// (class is lazy-loaded on onLayoutReady — practically instant, but guard anyway)
	if (!plugin.EmbeddableEditor) {
		return (
			<textarea
				class="ep:w-full ep:px-3 ep:py-2 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:min-h-[80px] ep:resize-y"
				value={content}
				onInput={(e) =>
					onFieldChange(fieldName, (e.target as HTMLTextAreaElement).value)
				}
			/>
		);
	}

	return (
		<div
			ref={containerRef}
			class="ep:w-full ep:min-h-[80px] ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden"
		/>
	);
}
