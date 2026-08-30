import { Compartment } from "@codemirror/state";
import { placeholder } from "@codemirror/view";
import { Platform } from "obsidian";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";

import type { EmbeddableEditorInstance } from "@true-recall/obsidian/editor/shared/embedded-editor";
import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/obsidian/utils/cn";

interface TypeInCMEditorProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	placeholderText: string;
}

function ShortcutHint({ isVisible }: { isVisible: boolean }) {
	if (Platform.isMobile) return null;
	const modifier = Platform.isMacOS ? "⌘" : "Ctrl";
	return (
		<div
			aria-hidden={!isVisible}
			class={cn(
				"ep:text-ui-smaller ep:text-obs-faint ep:transition-opacity",
				isVisible ? "ep:opacity-100" : "ep:opacity-0",
			)}
		>
			<kbd class="ep:text-[10px] ep:font-normal">{modifier} Enter</kbd> to check
		</div>
	);
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
		const rafId = window.requestAnimationFrame(() => editor.cm.focus());

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

	const hasContent = value.trim().length > 0;

	const editorField = plugin.EmbeddableEditor ? (
		<div
			ref={containerRef}
			class="true-recall-add-field ep:w-full ep:min-h-[1.6em] ep:bg-transparent ep:border-b ep:border-obs-border ep:focus-within:border-obs-interactive ep:transition-colors ep:[&_.cm-content]:px-0 ep:[&_.cm-content]:text-center ep:[&_.cm-content]:text-obs-muted"
		/>
	) : (
		<textarea
			ref={textareaRef}
			class="ep:w-full ep:min-h-[1.6em] ep:px-0 ep:py-1 ep:text-ui-small ep:text-obs-muted ep:text-center ep:bg-transparent ep:border-0 ep:border-b ep:border-obs-border ep:rounded-none ep:resize-y ep:shadow-none ep:focus:border-obs-interactive ep:focus:shadow-none ep:transition-colors"
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

	return (
		<div class="ep:w-full ep:max-w-md ep:mx-auto ep:flex ep:flex-col ep:gap-1.5">
			{editorField}
			<div class="ep:flex ep:justify-center">
				<ShortcutHint isVisible={hasContent} />
			</div>
		</div>
	);
}
