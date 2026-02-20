import type { ImageService } from "@features/integration/services/ImageService";
import {
	insertAtTextareaCursor,
	toggleTextareaWrap,
} from "@features/library/ui/editor/edit-toolbar.utils";
import type { FlashcardParserService } from "@features/study/services/flashcard/flashcard-parser.service";
import { FLASHCARD_CONFIG } from "@shared/constants";
import { notify } from "@shared/services/notification.service";
import type {
	SimpleFlashcardEditorOptions,
	SimpleFlashcardEditorResult,
} from "@shared/ui/modals/SimpleFlashcardEditorModal";
import { KeyboardShortcutsHint } from "@shared/ui/modals/simple-editor/KeyboardShortcutsHint";
import { SECONDARY_BUTTON_CLASSES } from "@shared/ui/utils/tailwind";
import { stripBrTags } from "@shared/utils";
import { type App, Component, MarkdownRenderer } from "obsidian";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

export interface SimpleEditorBodyProps {
	app: App;
	options: SimpleFlashcardEditorOptions;
	parser: FlashcardParserService;
	imageService: ImageService;
	onSubmit: (result: SimpleFlashcardEditorResult) => void;
	onClose: () => void;
}

export function SimpleEditorBody({
	app,
	options,
	parser,
	imageService,
	onSubmit,
	onClose,
}: SimpleEditorBodyProps) {
	const [isPreviewMode, setIsPreviewMode] = useState(false);
	const [content, setContent] = useState(options.prefillContent ?? "");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const previewRef = useRef<HTMLDivElement>(null);
	const previewComponentRef = useRef<Component | null>(null);

	const contentRef = useRef(content);
	contentRef.current = content;

	useEffect(() => {
		if (!isPreviewMode || !previewRef.current) return;

		if (previewComponentRef.current) {
			previewComponentRef.current.unload();
		}

		const el = previewRef.current;
		el.empty();

		if (!contentRef.current.trim()) {
			el.createDiv({
				text: "No content to preview",
				cls: "ep:text-obs-muted ep:italic",
			});
			return;
		}

		previewComponentRef.current = new Component();
		previewComponentRef.current.load();

		void MarkdownRenderer.render(
			app,
			stripBrTags(contentRef.current),
			el,
			options.currentFilePath,
			previewComponentRef.current,
		);

		return () => {
			previewComponentRef.current?.unload();
			previewComponentRef.current = null;
		};
	}, [isPreviewMode, app, options.currentFilePath]);

	useEffect(() => {
		if (!isPreviewMode && textareaRef.current) {
			const ta = textareaRef.current;
			setTimeout(() => {
				ta.focus();
				ta.selectionStart = ta.value.length;
				ta.selectionEnd = ta.value.length;
			}, 50);
		}
	}, [isPreviewMode]);

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
		[insertFlashcardTag, onClose],
	);

	const handlePaste = useCallback(
		async (e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			for (const item of Array.from(items)) {
				if (item.type.startsWith("image/")) {
					e.preventDefault();
					const file = item.getAsFile();
					if (!file) return;

					try {
						const savedPath = await imageService.saveImageFromClipboard(file);
						if (!savedPath) {
							notify().warning("Failed to save image");
							return;
						}
						const markdown = imageService.buildImageMarkdown(savedPath, 500);
						if (textareaRef.current) {
							insertAtTextareaCursor(textareaRef.current, markdown);
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

	const handleSave = useCallback(() => {
		const currentContent = isPreviewMode
			? contentRef.current.trim()
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
	}, [isPreviewMode, parser, options.editCardId, onSubmit]);

	const togglePreview = useCallback(() => {
		if (!isPreviewMode && textareaRef.current) {
			setContent(textareaRef.current.value);
		}
		setIsPreviewMode((prev) => !prev);
	}, [isPreviewMode]);

	const buttonText =
		options.mode === "add" ? "Save Flashcards" : "Save Changes";

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
			{isPreviewMode ? (
				<div
					ref={previewRef}
					class="ep:w-full ep:min-h-[350px] ep:max-h-[450px] ep:p-4 ep:text-ui-small ep:leading-[1.6] ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-lg ep:text-obs-normal ep:overflow-y-auto"
				/>
			) : (
				<textarea
					ref={textareaRef}
					class="ep:w-full ep:min-h-[350px] ep:p-4 ep:font-mono ep:text-ui-small ep:leading-[1.6] ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-lg ep:resize-y ep:text-obs-normal ep:focus-visible:outline-none ep:focus-visible:border-obs-interactive ep:placeholder:text-obs-faint"
					placeholder={`What is photosynthesis? ${FLASHCARD_CONFIG.tag}\nThe process by which plants convert light into energy\n\nWhat are the inputs? ${FLASHCARD_CONFIG.tag}\nSunlight, water, and CO2`}
					spellcheck={true}
					value={content}
					onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
				/>
			)}

			{/* Shortcuts hint */}
			<KeyboardShortcutsHint />

			{/* Buttons */}
			<div class="ep:flex ep:justify-between ep:items-center ep:gap-3 ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border">
				{/* Left: Preview toggle */}
				<div class="ep:flex ep:items-center ep:gap-2">
					<label class="ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-ui-smaller ep:text-obs-muted">
						<input
							type="checkbox"
							class="ep:cursor-pointer"
							checked={isPreviewMode}
							onChange={togglePreview}
						/>
						<span>Preview</span>
					</label>
				</div>

				{/* Right: Cancel + Save */}
				<div class="ep:flex ep:gap-3">
					<button
						type="button"
						class={SECONDARY_BUTTON_CLASSES}
						onClick={onClose}
					>
						Cancel
					</button>
					<button
						type="button"
						class="ep:py-3 ep:px-5 ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-interactive-hover"
						onClick={handleSave}
					>
						{buttonText}
					</button>
				</div>
			</div>
		</div>
	);
}
