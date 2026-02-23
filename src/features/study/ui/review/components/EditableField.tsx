import { setupAutoResize } from "@features/study/ui/editor/edit-toolbar.utils";
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

	const handleBlur = useCallback(() => {
		if (textareaRef.current) onSave(textareaRef.current, field);
	}, [field, onSave]);

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

	const fieldCls =
		field === "question"
			? "true-recall-review-question ep:text-xl ep:leading-relaxed ep:text-obs-normal ep:mb-6"
			: "true-recall-review-answer ep:text-lg ep:leading-relaxed ep:text-obs-muted";

	return (
		<div class={fieldCls} data-field={field} data-source-path={sourcePath}>
			<textarea
				ref={textareaRef}
				class="ep:w-full ep:resize-none ep-textarea-invisible"
				value={stripBrTags(content)}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
				onPaste={handlePaste}
			/>
		</div>
	);
}
