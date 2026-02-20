import {
	insertAtTextareaCursor,
	setupAutoResize,
	TOOLBAR_BUTTONS,
	type ToolbarButtonAction,
	toggleTextareaWrap,
} from "@features/study/ui/editor/edit-toolbar.utils";
import { EditToolbar } from "@features/study/ui/review/components/EditToolbar";
import { stripBrTags } from "@shared/utils";
import { useCallback, useEffect, useRef } from "preact/hooks";

export interface EditableFieldProps {
	content: string;
	field: "question" | "answer";
	sourcePath: string;
	isAnswerRevealed: boolean;
	onSave: (textarea: HTMLTextAreaElement, field: "question" | "answer") => void;
	onStartEdit: (field: "question" | "answer") => void;
	onImagePaste: (file: File, textarea: HTMLTextAreaElement) => void;
}

export function EditableField({
	content,
	field,
	sourcePath,
	isAnswerRevealed,
	onSave,
	onStartEdit,
	onImagePaste,
}: EditableFieldProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const cleanupRef = useRef<(() => void) | null>(null);

	// Auto-focus + auto-resize on mount
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		cleanupRef.current = setupAutoResize(textarea);

		setTimeout(() => {
			textarea.focus();
			const len = textarea.value.length;
			textarea.setSelectionRange(len, len);
			textarea.scrollIntoView({ behavior: "smooth", block: "center" });
		}, 10);

		return () => cleanupRef.current?.();
	}, []);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				if (textareaRef.current) onSave(textareaRef.current, field);
			} else if (e.key === "Tab") {
				e.preventDefault();
				const textarea = textareaRef.current;
				if (!textarea) return;
				const nextField = field === "question" ? "answer" : "question";
				if (nextField === "answer" && !isAnswerRevealed) return;
				onSave(textarea, field);
				onStartEdit(nextField);
			}
		},
		[field, isAnswerRevealed, onSave, onStartEdit],
	);

	const handleBlur = useCallback(
		(e: FocusEvent) => {
			const relatedTarget = e.relatedTarget as HTMLElement | null;
			if (relatedTarget?.closest(".true-recall-edit-toolbar")) return;
			if (textareaRef.current) onSave(textareaRef.current, field);
		},
		[field, onSave],
	);

	const handlePaste = useCallback(
		(e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;
			for (const item of Array.from(items)) {
				if (item.type.startsWith("image/")) {
					e.preventDefault();
					const file = item.getAsFile();
					if (file && textareaRef.current) {
						onImagePaste(file, textareaRef.current);
					}
					return;
				}
			}
		},
		[onImagePaste],
	);

	const executeAction = useCallback((action: ToolbarButtonAction) => {
		const textarea = textareaRef.current;
		if (!textarea) return;
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
		textarea.focus();
	}, []);

	const fieldCls =
		field === "question"
			? "true-recall-review-question ep:text-xl ep:leading-relaxed ep:text-obs-normal ep:mb-6 ep:relative"
			: "true-recall-review-answer ep:text-lg ep:leading-relaxed ep:text-obs-muted ep:relative";

	return (
		<div class={fieldCls} data-field={field} data-source-path={sourcePath}>
			<div class="ep:w-full ep:relative">
				<textarea
					ref={textareaRef}
					class="ep:w-full ep:text-center ep:text-obs-normal ep:resize-none ep-textarea-invisible"
					value={stripBrTags(content)}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
					onPaste={handlePaste}
				/>
				<EditToolbar
					buttons={TOOLBAR_BUTTONS.UNIFIED}
					onAction={executeAction}
				/>
			</div>
		</div>
	);
}
