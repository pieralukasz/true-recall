import type { EmbeddableEditorInstance } from "@shared/ui/editor/embedded-editor";
import { useApp, usePlugin } from "@shared/ui/preact/ObsidianContext";
import type { CardTemplate } from "@shared/types/note.types";
import { Clickable } from "@shared/ui/components";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { TemplatePreview } from "./TemplatePreview";

interface TemplateEditorProps {
	template: CardTemplate;
	fields: string[];
	readOnly: boolean;
	noteTypeType: 0 | 1;
	onTemplateChange: (updated: CardTemplate) => void;
	onDelete?: () => void;
	isOnlyTemplate: boolean;
}

export function TemplateEditor({
	template,
	fields,
	readOnly,
	noteTypeType,
	onTemplateChange,
	onDelete,
	isOnlyTemplate,
}: TemplateEditorProps) {
	return (
		<div class="ep:border ep:border-obs-border ep:rounded-md ep:p-3 ep:space-y-3">
			<div class="ep:flex ep:items-center ep:gap-2">
				<input
					type="text"
					class="ep:flex-1 ep:px-2 ep:py-1 ep:text-ui-small ep:font-medium ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
					value={template.name}
					disabled={readOnly}
					onBlur={(e) =>
						onTemplateChange({
							...template,
							name: (e.target as HTMLInputElement).value.trim() || template.name,
						})
					}
				/>
				{!readOnly && onDelete && (
					<Clickable
						class="ep:text-ui-smaller ep:text-obs-error ep:hover:text-obs-error/80 ep:px-2"
						onClick={onDelete}
						disabled={isOnlyTemplate}
					>
						Delete template
					</Clickable>
				)}
			</div>

			<TemplateCodeEditor
				label="Front template (qfmt)"
				value={template.qfmt}
				readOnly={readOnly}
				onChange={(val) => onTemplateChange({ ...template, qfmt: val })}
			/>

			<TemplateCodeEditor
				label="Back template (afmt)"
				value={template.afmt}
				readOnly={readOnly}
				onChange={(val) => onTemplateChange({ ...template, afmt: val })}
			/>

			{!readOnly && (
				<div class="ep:flex ep:flex-wrap ep:gap-1.5">
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:mr-1">
						Insert:
					</span>
					{fields.map((f) => (
						<FieldChip key={f} label={`{{${f}}}`} />
					))}
					{noteTypeType === 1 &&
						fields.map((f) => (
							<FieldChip key={`cloze-${f}`} label={`{{cloze:${f}}}`} />
						))}
				</div>
			)}

			<TemplatePreview
				template={template}
				fields={fields}
				noteTypeType={noteTypeType}
			/>
		</div>
	);
}

function FieldChip({ label }: { label: string }) {
	return (
		<span
			class="ep:text-ui-smaller ep:px-1.5 ep:py-0.5 ep:bg-obs-accent/10 ep:text-obs-accent ep:rounded ep:cursor-default ep:select-all"
			title={`Copy: ${label}`}
		>
			{label}
		</span>
	);
}

function TemplateCodeEditor({
	label,
	value,
	readOnly,
	onChange,
}: {
	label: string;
	value: string;
	readOnly: boolean;
	onChange: (value: string) => void;
}) {
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
		// Only create/destroy on mount/unmount or readOnly change
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [app, plugin.EmbeddableEditor, readOnly]);

	// Sync external value changes
	useLayoutEffect(() => {
		if (editorRef.current && editorRef.current.value !== value) {
			editorRef.current.set(value);
		}
	}, [value]);

	return (
		<div>
			<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-1">
				{label}
			</div>
			{readOnly || !plugin.EmbeddableEditor ? (
				<textarea
					class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:font-mono ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:min-h-[48px] ep:resize-y"
					value={value}
					disabled={readOnly}
					onBlur={(e) =>
						onChange((e.target as HTMLTextAreaElement).value)
					}
				/>
			) : (
				<div
					ref={containerRef}
					class="ep:border ep:border-obs-border ep:rounded-md ep:min-h-[48px] ep:overflow-hidden"
				/>
			)}
		</div>
	);
}
