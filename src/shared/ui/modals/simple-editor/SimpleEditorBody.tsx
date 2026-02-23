import type { ImageService } from "@features/integration/services/ImageService";
import type { FlashcardParserService } from "@features/study/services/flashcard/flashcard-parser.service";
import {
	insertAtTextareaCursor,
	toggleTextareaWrap,
} from "@features/study/ui/editor/edit-toolbar.utils";
import { EditorView, placeholder } from "@codemirror/view";
import { FLASHCARD_CONFIG } from "@shared/constants";
import type {
	EmbeddableEditorClass,
	EmbeddableEditorInstance,
} from "@shared/ui/editor/embedded-editor";
import { notify } from "@shared/services/notification.service";
import type {
	SimpleFlashcardEditorOptions,
	SimpleFlashcardEditorResult,
} from "@shared/ui/modals/SimpleFlashcardEditorModal";
import { KeyboardShortcutsHint } from "@shared/ui/modals/simple-editor/KeyboardShortcutsHint";
import { Clickable } from "@shared/ui/components";
import { SECONDARY_BUTTON_CLASSES } from "@shared/ui/utils/tailwind";
import type { App } from "obsidian";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

export interface SimpleEditorBodyProps {
	app: App;
	options: SimpleFlashcardEditorOptions;
	parser: FlashcardParserService;
	imageService: ImageService;
	editorClass?: EmbeddableEditorClass | null;
	onSubmit: (result: SimpleFlashcardEditorResult) => void;
	onClose: () => void;
}

export function SimpleEditorBody({
	app,
	options,
	parser,
	imageService,
	editorClass,
	onSubmit,
	onClose,
}: SimpleEditorBodyProps) {
	const useRichEditor = editorClass != null;

	const buttonText =
		options.mode === "add" ? "Save Flashcards" : "Save Changes";

	// ── Shared refs ──────────────────────────────────────────────────
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const editorContainerRef = useRef<HTMLDivElement>(null);

	// ── Save handler ─────────────────────────────────────────────────
	const handleSave = useCallback(() => {
		const currentContent = useRichEditor
			? (editorRef.current?.value ?? "").trim()
			: (textareaRef.current?.value ?? "").trim();

		if (!currentContent) {
			notify().warning("Please enter some flashcard content");
			return;
		}

		const flashcards = parser.extractFlashcards(currentContent);
		if (flashcards.length === 0) {
			notify().warning(
				`No flashcards found. Use "${FLASHCARD_CONFIG.tag}" tag after questions.`,
			);
			return;
		}

		onSubmit({
			cancelled: false,
			flashcards,
			editedCardId: options.editCardId,
		});
	}, [useRichEditor, parser, options.editCardId, onSubmit]);

	// Ref indirection so editor callbacks always call the latest handleSave
	const handleSaveRef = useRef(handleSave);
	handleSaveRef.current = handleSave;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	// ── CM6 extensions ───────────────────────────────────────────────
	const placeholderExt = useMemo(
		() =>
			placeholder(
				`What is photosynthesis? ${FLASHCARD_CONFIG.tag}\nThe process by which plants convert light into energy`,
			),
		[],
	);

	// Ctrl/Cmd+3 to insert #flashcard tag — DOM handler to bypass Obsidian's scope
	const flashcardTagExt = useMemo(
		() =>
			EditorView.domEventHandlers({
				keydown(event, view) {
					const isMod = event.ctrlKey || event.metaKey;
					if (!isMod || (event.key !== "3" && event.key !== "#"))
						return false;
					event.preventDefault();
					event.stopPropagation();
					const pos = view.state.selection.main.head;
					const line = view.state.doc.lineAt(pos);
					if (line.text.includes(FLASHCARD_CONFIG.tag)) return true;
					const tag = ` ${FLASHCARD_CONFIG.tag}`;
					view.dispatch({
						changes: { from: line.to, insert: tag },
						selection: { anchor: line.to + tag.length },
					});
					return true;
				},
			}),
		[],
	);

	// ── Image paste handler for embedded editor ──────────────────────
	const handleEditorPaste = useCallback(
		async (e: ClipboardEvent, editor: EmbeddableEditorInstance) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			for (const item of Array.from(items)) {
				if (item.type.startsWith("image/")) {
					e.preventDefault();
					const file = item.getAsFile();
					if (!file) return;

					try {
						const savedPath =
							await imageService.saveImageFromClipboard(file);
						if (!savedPath) {
							notify().warning("Failed to save image");
							return;
						}
						const markdown = imageService.buildImageMarkdown(
							savedPath,
							500,
						);
						const view = editor.cm;
						const pos = view.state.selection.main.head;
						view.dispatch({
							changes: { from: pos, insert: markdown },
						});
					} catch (error) {
						console.error("Error saving image:", error);
						notify().operationFailed("save image", error);
					}
					return;
				}
			}
		},
		[imageService],
	);

	// ── Create embedded editor on mount ──────────────────────────────
	useEffect(() => {
		if (!useRichEditor || !editorClass || !editorContainerRef.current)
			return;

		const el = editorContainerRef.current;

		const editor = new editorClass(app, el, {
			value: options.prefillContent ?? "",
			onEscape: () => onCloseRef.current(),
			onModEnter: () => handleSaveRef.current(),
			onPaste: handleEditorPaste,
			extraExtensions: [flashcardTagExt, placeholderExt],
		});

		editorRef.current = editor;

		// Focus the editor after a short delay (modal animation)
		setTimeout(() => editor.cm.focus(), 50);

		return () => {
			editorRef.current = null;
			editor.destroy();
		};
	}, [app, useRichEditor, editorClass, flashcardTagExt, handleEditorPaste]);

	// ── Textarea-only: state & handlers (for fallback) ───────────────
	const [content, setContent] = useState(options.prefillContent ?? "");

	const insertFlashcardTag = useCallback(() => {
		const ta = textareaRef.current;
		if (!ta) return;

		const pos = ta.selectionStart;
		const text = ta.value;

		let lineEnd = text.indexOf("\n", pos);
		if (lineEnd === -1) lineEnd = text.length;

		const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
		const currentLine = text.slice(lineStart, lineEnd);
		if (currentLine.includes(FLASHCARD_CONFIG.tag)) return;

		const tagText = ` ${FLASHCARD_CONFIG.tag}`;
		const before = text.slice(0, lineEnd);
		const after = text.slice(lineEnd);
		ta.value = before + tagText + after;
		setContent(ta.value);

		const newPos = lineEnd + tagText.length;
		ta.selectionStart = newPos;
		ta.selectionEnd = newPos;
		ta.focus();
	}, []);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			const isMod = e.ctrlKey || e.metaKey;
			const ta = textareaRef.current;

			if (isMod && (e.key === "3" || e.key === "#")) {
				e.preventDefault();
				insertFlashcardTag();
				return;
			}
			if (isMod && e.key === "b") {
				e.preventDefault();
				if (ta) toggleTextareaWrap(ta, "**", "**");
				return;
			}
			if (isMod && e.key === "i") {
				e.preventDefault();
				if (ta) toggleTextareaWrap(ta, "*", "*");
				return;
			}
			if (isMod && e.key === "k") {
				e.preventDefault();
				if (ta) toggleTextareaWrap(ta, "[[", "]]");
				return;
			}
			if (isMod && e.shiftKey && e.key.toLowerCase() === "c") {
				e.preventDefault();
				if (ta) toggleTextareaWrap(ta, "```\n", "\n```");
				return;
			}
			if (isMod && e.key === "Enter") {
				e.preventDefault();
				handleSave();
				return;
			}
			if (e.key === "Escape" && !e.isComposing) {
				e.preventDefault();
				onClose();
				return;
			}
		},
		[insertFlashcardTag, onClose, handleSave],
	);

	const handleTextareaPaste = useCallback(
		async (e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			for (const item of Array.from(items)) {
				if (item.type.startsWith("image/")) {
					e.preventDefault();
					const file = item.getAsFile();
					if (!file) return;

					try {
						const savedPath =
							await imageService.saveImageFromClipboard(file);
						if (!savedPath) {
							notify().warning("Failed to save image");
							return;
						}
						const markdown = imageService.buildImageMarkdown(
							savedPath,
							500,
						);
						if (textareaRef.current) {
							insertAtTextareaCursor(
								textareaRef.current,
								markdown,
							);
							setContent(textareaRef.current.value);
							textareaRef.current.focus();
						}
					} catch (error) {
						console.error("Error saving image:", error);
						notify().operationFailed("save image", error);
					}
					return;
				}
			}
		},
		[imageService],
	);

	useEffect(() => {
		if (useRichEditor) return;
		if (!textareaRef.current) return;
		const ta = textareaRef.current;
		setTimeout(() => {
			ta.focus();
			ta.selectionStart = ta.value.length;
			ta.selectionEnd = ta.value.length;
		}, 50);
	}, [useRichEditor]);

	// ── Render ────────────────────────────────────────────────────────
	return (
		<div>
			{/* Hint */}
			<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-3">
				<span>Format: </span>
				<code class="ep:px-1 ep:py-1 ep:bg-obs-secondary ep:rounded ep:text-ui-smaller">
					{`Question ${FLASHCARD_CONFIG.tag}`}
				</code>
				<span> then answer on next line(s)</span>
			</div>

			{/* Content area */}
			{useRichEditor ? (
				<div
					ref={editorContainerRef}
					class="ep-simple-editor-container"
				/>
			) : (
				<textarea
					ref={textareaRef}
					class="ep:w-full ep:min-h-87.5 ep:p-4 ep:text-ui-small ep:leading-[1.6] ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-lg ep:resize-y ep:text-obs-normal ep:focus-visible:outline-none ep:focus-visible:border-obs-interactive ep:placeholder:text-obs-faint"
					placeholder={`What is photosynthesis? ${FLASHCARD_CONFIG.tag}\nThe process by which plants convert light into energy\n\nWhat are the inputs? ${FLASHCARD_CONFIG.tag}\nSunlight, water, and CO2`}
					spellcheck={true}
					value={content}
					onInput={(e) =>
						setContent((e.target as HTMLTextAreaElement).value)
					}
					onKeyDown={handleKeyDown}
					onPaste={handleTextareaPaste}
				/>
			)}

			{/* Shortcuts hint */}
			<KeyboardShortcutsHint useRichEditor={useRichEditor} />

			{/* Buttons */}
			<div class="ep-modal-footer ep:flex ep:justify-end ep:items-center ep:gap-3 ep:mt-4">
				<Clickable
					class={SECONDARY_BUTTON_CLASSES}
					onClick={onClose}
					stopPropagation={false}
				>
					Cancel
				</Clickable>
				<Clickable
					class="mod-cta ep-btn"
					onClick={handleSave}
					stopPropagation={false}
				>
					{buttonText}
				</Clickable>
			</div>
		</div>
	);
}
