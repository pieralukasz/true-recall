import type { EmbeddableEditorInstance } from "@true-recall/obsidian/editor/shared/embedded-editor";
import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";

interface TemplateCodeEditorProps {
	value: string;
	readOnly: boolean;
	onChange: (value: string) => void;
	tall?: boolean;
}

export function TemplateCodeEditor({
	value,
	readOnly,
	onChange,
	tall,
}: TemplateCodeEditorProps) {
	const app = useApp();
	const plugin = usePlugin();
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		const el = containerRef.current;
		if (!el || !plugin.EmbeddableEditor || readOnly) return;

		const editor = new plugin.EmbeddableEditor(app, el, {
			value,
			onBlur: (ed) => onChangeRef.current(ed.value),
		});
		editorRef.current = editor;
		return () => {
			editorRef.current = null;
			editor.destroy();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only recreate editor on mount or readOnly change; value sync handled separately
	}, [app, plugin.EmbeddableEditor, readOnly]);

	useLayoutEffect(() => {
		if (editorRef.current && editorRef.current.value !== value) {
			editorRef.current.set(value);
		}
	}, [value]);

	const heightCls = tall ? "ep:h-full" : "ep:min-h-[48px]";

	return readOnly || !plugin.EmbeddableEditor ? (
		<textarea
			class={`ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:font-mono ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:resize-y ${heightCls}`}
			value={value}
			disabled={readOnly}
			onBlur={(e) => onChange((e.target as HTMLTextAreaElement).value)}
		/>
	) : (
		<div
			ref={containerRef}
			class={`ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden ${heightCls}`}
		/>
	);
}
