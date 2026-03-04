import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { ImageService } from "@features/integration/services/ImageService";
import { FlashcardParserService } from "@features/study/services/flashcard/flashcard-parser.service";
import {
	insertAtTextareaCursor,
	toggleTextareaWrap,
} from "@features/study/ui/editor/edit-toolbar.utils";
import { type ViewUpdate, placeholder } from "@codemirror/view";
import type {
	EmbeddableEditorClass,
	EmbeddableEditorInstance,
} from "@shared/ui/editor/embedded-editor";
import { notify } from "@shared/services/notification.service";
import type { FlashcardItem } from "@shared/types";
import { KeyboardShortcutsHint } from "@shared/ui/modals/simple-editor/KeyboardShortcutsHint";
import { NotePickerCombobox } from "@shared/ui/modals/simple-editor/NotePickerCombobox";
import { Clickable } from "@shared/ui/components";
import { SECONDARY_BUTTON_CLASSES } from "@shared/ui/utils/tailwind";
import type { App, TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

export interface AddFlashcardsAppProps {
	app: App;
	mode: "add" | "edit";
	flashcardManager?: FlashcardManager | null;
	imageService: ImageService;
	editorClass?: EmbeddableEditorClass | null;
	prefillContent?: string;
	editCardId?: string;
	initialNote: TFile | null;
	onDone: (result: AddFlashcardsResult) => void;
	onClose: () => void;
}

export interface AddFlashcardsResult {
	cancelled: boolean;
	flashcards: FlashcardItem[];
	editedCardId?: string;
	totalSaved: number;
}

const PLACEHOLDER_TEXT = `What is photosynthesis? :: The process by which plants convert light into energy
Capital of France :: Paris
{{c1::Mitochondria}} are the powerhouse of the cell :: Extra context`;

export function AddFlashcardsApp({
	app,
	mode,
	flashcardManager,
	imageService,
	editorClass,
	prefillContent,
	editCardId,
	initialNote,
	onDone,
	onClose,
}: AddFlashcardsAppProps) {
	const useRichEditor = editorClass != null;
	const isAddMode = mode === "add";

	const [selectedNote, setSelectedNote] = useState<TFile | null>(initialNote);
	const [totalSaved, setTotalSaved] = useState(0);
	const [saving, setSaving] = useState(false);
	const [cardCount, setCardCount] = useState(0);

	const parser = useMemo(() => new FlashcardParserService(), []);

	// ── Refs ──────────────────────────────────────────────────────────
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const editorContainerRef = useRef<HTMLDivElement>(null);

	// ── Content reading ──────────────────────────────────────────────
	const getContent = useCallback((): string => {
		if (useRichEditor) {
			return (editorRef.current?.value ?? "").trim();
		}
		return (textareaRef.current?.value ?? "").trim();
	}, [useRichEditor]);

	// ── Clear editor ─────────────────────────────────────────────────
	const clearEditor = useCallback(() => {
		if (useRichEditor && editorRef.current) {
			const cm = editorRef.current.cm;
			cm.dispatch({
				changes: {
					from: 0,
					to: cm.state.doc.length,
					insert: "",
				},
			});
			setTimeout(() => cm.focus(), 50);
		} else if (textareaRef.current) {
			textareaRef.current.value = "";
			setTimeout(() => textareaRef.current?.focus(), 50);
		}
	}, [useRichEditor]);

	// ── Live card count ──────────────────────────────────────────────
	const updateCardCount = useCallback(
		(text: string) => {
			const count = parser.extractFlashcards(text.trim()).length;
			setCardCount(count);
		},
		[parser],
	);

	const handleEditorChange = useCallback(
		(update: ViewUpdate) => {
			updateCardCount(update.state.doc.toString());
		},
		[updateCardCount],
	);

	// ── Save handler ─────────────────────────────────────────────────
	const handleSave = useCallback(async () => {
		const currentContent = getContent();
		if (!currentContent) {
			notify().warning("Please enter some flashcard content");
			return;
		}

		const flashcards = parser.extractFlashcards(currentContent);
		if (flashcards.length === 0) {
			notify().warning(
				"No flashcards detected. Use Front :: Back format (one card per line).",
			);
			return;
		}

		if (isAddMode) {
			if (!selectedNote) {
				notify().warning("Please select a target note first");
				return;
			}
			if (!flashcardManager) {
				notify().error("Card manager not available");
				return;
			}

			setSaving(true);
			try {
				const result = await flashcardManager.saveFlashcardsToSql(
					selectedNote,
					flashcards,
				);
				const count = result.created.length;
				setTotalSaved((prev) => prev + count);

				const dupeCount = result.duplicates.length;
				const dupeMsg =
					dupeCount > 0
						? ` (${dupeCount} duplicate${dupeCount > 1 ? "s" : ""} skipped)`
						: "";
				notify().info(
					`Saved ${count} flashcard${count !== 1 ? "s" : ""} to ${selectedNote.basename}${dupeMsg}`,
				);

				clearEditor();
			} catch (error) {
				const msg =
					error instanceof Error ? error.message : String(error);
				notify().error(`Failed to save: ${msg}`);
			} finally {
				setSaving(false);
			}
		} else {
			onDone({
				cancelled: false,
				flashcards,
				editedCardId: editCardId,
				totalSaved: 0,
			});
		}
	}, [
		getContent,
		parser,
		isAddMode,
		selectedNote,
		flashcardManager,
		clearEditor,
		editCardId,
		onDone,
	]);

	// Ref indirection so callbacks always call the latest
	const handleSaveRef = useRef(handleSave);
	handleSaveRef.current = handleSave;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	// ── CM6 extensions ───────────────────────────────────────────────
	const placeholderExt = useMemo(
		() => placeholder(isAddMode ? PLACEHOLDER_TEXT : "Edit your flashcard content..."),
		[isAddMode],
	);

	// ── Image paste for embedded editor ──────────────────────────────
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
			value: prefillContent ?? "",
			onEscape: () => onCloseRef.current(),
			onModEnter: () => handleSaveRef.current(),
			onChange: handleEditorChange,
			onPaste: handleEditorPaste,
			extraExtensions: [placeholderExt],
		});

		editorRef.current = editor;
		setTimeout(() => editor.cm.focus(), 50);

		return () => {
			editorRef.current = null;
			editor.destroy();
		};
	}, [
		app,
		useRichEditor,
		editorClass,
		handleEditorChange,
		handleEditorPaste,
	]);

	// ── Textarea state & handlers (fallback) ─────────────────────────
	const [content, setContent] = useState(prefillContent ?? "");

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			const isMod = e.ctrlKey || e.metaKey;
			const ta = textareaRef.current;

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
				void handleSave();
				return;
			}
			if (e.key === "Escape" && !e.isComposing) {
				e.preventDefault();
				onClose();
				return;
			}
		},
		[onClose, handleSave],
	);

	const handleTextareaInput = useCallback(
		(e: Event) => {
			setContent((e.target as HTMLTextAreaElement).value);
		},
		[],
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

	// Update card count when textarea content changes
	useEffect(() => {
		if (useRichEditor) return;
		updateCardCount(content);
	}, [useRichEditor, content, updateCardCount]);

	// Parse prefilled content on mount (rich editor mode)
	useEffect(() => {
		if (prefillContent) {
			updateCardCount(prefillContent);
		}
	}, [prefillContent, updateCardCount]);

	// ── Handle close (resolve with summary in add mode) ──────────────
	const handleClose = useCallback(() => {
		if (isAddMode) {
			onDone({
				cancelled: totalSaved === 0,
				flashcards: [],
				totalSaved,
			});
		} else {
			onDone({
				cancelled: true,
				flashcards: [],
				totalSaved: 0,
			});
		}
	}, [isAddMode, totalSaved, onDone]);

	// ── Render ────────────────────────────────────────────────────────
	const buttonText = isAddMode
		? saving
			? "Saving..."
			: cardCount > 0
				? `Save ${cardCount} Flashcard${cardCount !== 1 ? "s" : ""}`
				: "Save Flashcards"
		: "Save Changes";

	return (
		<div class="ep:flex ep:flex-col ep:gap-4">
			{/* Note picker (add mode only) */}
			{isAddMode && (
				<NotePickerCombobox
					app={app}
					selectedNote={selectedNote}
					onSelect={setSelectedNote}
				/>
			)}

			{/* Editor area */}
			{useRichEditor ? (
				<div
					ref={editorContainerRef}
					class="ep-simple-editor-container"
				/>
			) : (
				<textarea
					ref={textareaRef}
					class="ep:w-full ep:min-h-80 ep:p-4 ep:text-ui-small ep:leading-[1.6] ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-lg ep:resize-y ep:text-obs-normal ep:focus-visible:outline-none ep:focus-visible:border-obs-interactive ep:placeholder:text-obs-faint"
					placeholder={isAddMode ? PLACEHOLDER_TEXT : "Edit your flashcard content..."}
					spellcheck={true}
					value={content}
					onInput={handleTextareaInput}
					onKeyDown={handleKeyDown}
					onPaste={handleTextareaPaste}
				/>
			)}

			{/* Shortcuts hint */}
			<KeyboardShortcutsHint useRichEditor={useRichEditor} />

			{/* Footer */}
			<div class="ep-modal-footer ep:flex ep:justify-between ep:items-center">
				{isAddMode && totalSaved > 0 ? (
					<span class="ep:text-ui-smaller ep:text-obs-green">
						{totalSaved} card{totalSaved !== 1 ? "s" : ""} saved this session
					</span>
				) : (
					<span />
				)}
				<div class="ep:flex ep:items-center ep:gap-3">
					<Clickable
						class={SECONDARY_BUTTON_CLASSES}
						onClick={handleClose}
						stopPropagation={false}
					>
						{isAddMode ? "Close" : "Cancel"}
					</Clickable>
					<Clickable
						class="mod-cta ep-btn"
						onClick={() => void handleSave()}
						disabled={saving}
						stopPropagation={false}
					>
						{buttonText}
					</Clickable>
				</div>
			</div>
		</div>
	);
}
