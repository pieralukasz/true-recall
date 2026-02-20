import { type App, Component, MarkdownRenderer } from "obsidian";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { FLASHCARD_CONFIG } from "../../constants";
import { FlashcardParserService } from "../../../features/study/services/flashcard/flashcard-parser.service";
import { notify } from "../../services/notification.service";
import { ImageService } from "../../../features/integration/services/ImageService";
import type { FlashcardItem } from "../../types";
import { stripBrTags } from "../../utils";
import {
	insertAtTextareaCursor,
	toggleTextareaWrap,
} from "../../../features/library/ui/editor/edit-toolbar.utils";
import { SECONDARY_BUTTON_CLASSES } from "../utils/tailwind";
import { BaseModal } from "./BaseModal";

export interface SimpleFlashcardEditorResult {
	cancelled: boolean;
	flashcards: FlashcardItem[];
	editedCardId?: string;
}

export interface SimpleFlashcardEditorOptions {
	mode: "add" | "edit";
	prefillContent?: string;
	editCardId?: string;
	currentFilePath: string;
}

interface SimpleEditorBodyProps {
	app: App;
	options: SimpleFlashcardEditorOptions;
	parser: FlashcardParserService;
	imageService: ImageService;
	onSubmit: (result: SimpleFlashcardEditorResult) => void;
	onClose: () => void;
}

const SHORTCUTS = [
	{ key: "Ctrl+3", action: "#flashcard" },
	{ key: "Ctrl+B", action: "bold" },
	{ key: "Ctrl+I", action: "italic" },
	{ key: "Ctrl+K", action: "[[link]]" },
	{ key: "Ctrl+Shift+C", action: "```code```" },
	{ key: "Ctrl+Enter", action: "save" },
];

function SimpleEditorBody({
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

	// Track content from textarea when switching to preview
	const contentRef = useRef(content);
	contentRef.current = content;

	// Render preview when switching to preview mode
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

	// Focus textarea on mount and when switching back to edit mode
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
			<div class="ep:text-ui-smaller ep:text-obs-faint ep:mt-2 ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1">
				{SHORTCUTS.map((s) => (
					<span key={s.key}>
						<kbd class="ep:px-1 ep:py-1 ep:bg-obs-secondary ep:rounded ep:text-ui-smaller ep:font-mono">
							{s.key}
						</kbd>
						{` ${s.action}`}
					</span>
				))}
			</div>

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

export class SimpleFlashcardEditorModal extends BaseModal {
	private options: SimpleFlashcardEditorOptions;
	private resolvePromise:
		| ((result: SimpleFlashcardEditorResult) => void)
		| null = null;
	private hasSubmitted = false;
	private parser: FlashcardParserService;
	private imageService: ImageService | null = null;
	private unmountBody?: () => void;

	constructor(app: App, options: SimpleFlashcardEditorOptions) {
		super(app, {
			title: options.mode === "add" ? "Add Flashcards" : "Edit Flashcard",
			width: "600px",
		});
		this.options = options;
		this.parser = new FlashcardParserService();
	}

	async openAndWait(): Promise<SimpleFlashcardEditorResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		this.imageService = new ImageService(this.app);
		super.onOpen();
		this.contentEl.addClass("true-recall-simple-flashcard-editor-modal");
	}

	protected renderBody(container: HTMLElement): void {
		if (!this.imageService) return;
		render(
			<SimpleEditorBody
				app={this.app}
				options={this.options}
				parser={this.parser}
				imageService={this.imageService}
				onSubmit={(result) => {
					this.hasSubmitted = true;
					if (this.resolvePromise) {
						this.resolvePromise(result);
						this.resolvePromise = null;
					}
					this.close();
				}}
				onClose={() => this.close()}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();

		const { contentEl } = this;
		contentEl.empty();

		if (!this.hasSubmitted && this.resolvePromise) {
			this.resolvePromise({
				cancelled: true,
				flashcards: [],
			});
			this.resolvePromise = null;
		}
	}
}

export {
	cardsToMarkdown,
	cardToMarkdown,
} from "../../../features/study/services/flashcard/flashcard-format.util";
