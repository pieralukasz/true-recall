import { type App, Component, MarkdownRenderer } from "obsidian";
import { useCallback, useEffect, useRef } from "preact/hooks";
import { stripBrTags } from "@shared/utils";
import {
	insertAtTextareaCursor,
	TOOLBAR_BUTTONS,
	type ToolbarButton,
	type ToolbarButtonAction,
	toggleTextareaWrap,
} from "@features/library/ui/editor/edit-toolbar.utils";

// ─── Toolbar Data ────────────────────────────────────────────────────

export function getToolbarButtons(
	onMediaPick: () => void,
	onShowHelp: () => void,
): ToolbarButton[] {
	return [
		...TOOLBAR_BUTTONS.UNIFIED,
		{
			id: "media",
			label: "Media",
			title: "Insert Image or Video",
			shortcut: "Ctrl+Shift+I",
			action: { type: "custom", handler: () => onMediaPick() },
		},
		{
			id: "help",
			label: "?",
			title: "Show keyboard shortcuts",
			shortcut: "Ctrl+/",
			action: { type: "custom", handler: () => onShowHelp() },
		},
	];
}

export function executeToolbarAction(
	action: ToolbarButtonAction,
	textarea: HTMLTextAreaElement,
): void {
	switch (action.type) {
		case "toggle":
			toggleTextareaWrap(textarea, action.before, action.after);
			break;
		case "insert":
			insertAtTextareaCursor(textarea, action.text);
			break;
		case "custom":
			action.handler(textarea);
			break;
	}
}

// ─── Toolbar Component ──────────────────────────────────────────────

interface ToolbarProps {
	buttons: ToolbarButton[];
	textareaRef: preact.RefObject<HTMLTextAreaElement>;
}

function Toolbar({ buttons, textareaRef }: ToolbarProps) {
	return (
		<div class="ep:flex ep:flex-wrap ep:justify-center ep:gap-1 ep:py-2 ep:border-t ep:border-obs-border">
			{buttons.map((btn) => {
				const title = btn.shortcut
					? `${btn.title} (${btn.shortcut})`
					: btn.title;
				return (
					<button
						type="button"
						key={btn.id}
						class="ep:px-2 ep:py-1 ep:text-ui-smaller ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive ep:transition-colors"
						title={title}
						tabIndex={-1}
						data-button-id={btn.id}
						onMouseDown={(e) => e.preventDefault()}
						onClick={(e) => {
							e.preventDefault();
							if (textareaRef.current) {
								executeToolbarAction(btn.action, textareaRef.current);
								textareaRef.current.focus();
							}
						}}
					>
						{btn.label}
					</button>
				);
			})}
		</div>
	);
}

// ─── Markdown Preview ───────────────────────────────────────────────

interface MarkdownPreviewProps {
	app: App;
	content: string;
	sourcePath: string;
	field: "question" | "answer";
	onClick: () => void;
}

function MarkdownPreview({
	app,
	content,
	sourcePath,
	field,
	onClick,
}: MarkdownPreviewProps) {
	const ref = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.empty();
		const comp = new Component();
		comp.load();
		void MarkdownRenderer.render(
			app,
			stripBrTags(content),
			el,
			sourcePath,
			comp,
		);
		return () => comp.unload();
	}, [app, content, sourcePath]);

	const answerCls = field === "answer" ? "ep:text-obs-muted" : "";

	return (
		<button
			type="button"
			ref={ref}
			class={`ep:min-h-20 ep:cursor-text ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-primary ep:text-ui-small ep:text-center ep:hover:border-obs-interactive ep:transition-colors ep:font-inherit ep:w-full ep:p-4 ${answerCls} true-recall-card-markdown`}
			onClick={onClick}
		/>
	);
}

// ─── Editor Field ───────────────────────────────────────────────────

export interface EditorFieldProps {
	app: App;
	label: string;
	field: "question" | "answer";
	value: string;
	isEditing: boolean;
	sourcePath: string;
	toolbarButtons: ToolbarButton[];
	onStartEdit: () => void;
	onSave: (value: string) => void;
	onTab: () => void;
	onChange: (value: string) => void;
	onPaste: (e: ClipboardEvent, textarea: HTMLTextAreaElement) => void;
}

export function EditorField({
	app,
	label,
	field,
	value,
	isEditing,
	sourcePath,
	toolbarButtons,
	onStartEdit,
	onSave,
	onTab,
	onChange,
	onPaste,
}: EditorFieldProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (isEditing && textareaRef.current) {
			const ta = textareaRef.current;
			setTimeout(() => {
				ta.focus();
				const len = ta.value.length;
				ta.setSelectionRange(len, len);
				ta.scrollIntoView({ behavior: "smooth", block: "center" });
			}, 10);
		}
	}, [isEditing]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				if (textareaRef.current) onSave(textareaRef.current.value);
			} else if (e.key === "Tab") {
				e.preventDefault();
				if (textareaRef.current) onSave(textareaRef.current.value);
				onTab();
			}
		},
		[onSave, onTab],
	);

	const handleBlur = useCallback(
		(e: FocusEvent) => {
			const relatedTarget = e.relatedTarget as HTMLElement | null;
			if (relatedTarget?.closest("[data-button-id]")) return;
			if (textareaRef.current) onSave(textareaRef.current.value);
		},
		[onSave],
	);

	return (
		<div class={field === "question" ? "ep:mb-4" : ""}>
			<div class="ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:uppercase ep:tracking-wide ep:mb-2">
				{label}
			</div>
			{isEditing ? (
				<div class="ep:rounded-lg ep:border ep:border-obs-interactive ep:bg-obs-primary ep:p-3">
					<div class="ep:w-full ep:relative">
						<textarea
							ref={textareaRef}
							class="ep:w-full ep:text-center ep:text-obs-normal ep:resize-none ep-textarea-invisible"
							placeholder={
								field === "question"
									? "Type your question here..."
									: "Type your answer here..."
							}
							data-field={field}
							value={value}
							onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
							onKeyDown={handleKeyDown}
							onBlur={handleBlur}
							onPaste={(e) => {
								if (textareaRef.current)
									onPaste(e as unknown as ClipboardEvent, textareaRef.current);
							}}
						/>
						<Toolbar buttons={toolbarButtons} textareaRef={textareaRef} />
					</div>
				</div>
			) : value.trim() ? (
				<MarkdownPreview
					app={app}
					content={value}
					sourcePath={sourcePath}
					field={field}
					onClick={onStartEdit}
				/>
			) : (
				<button
					type="button"
					class="ep:p-4 ep:min-h-20 ep:cursor-text ep:rounded-lg ep:border ep:border-dashed ep:border-obs-border ep:text-obs-muted ep:text-ui-small ep:text-center ep:hover:border-obs-interactive ep:transition-colors ep:flex ep:items-center ep:justify-center ep:bg-transparent ep:font-inherit ep:w-full"
					onClick={onStartEdit}
				>
					{field === "question"
						? "Click to add question..."
						: "Click to add answer..."}
				</button>
			)}
		</div>
	);
}
