import { type App, Component, MarkdownRenderer, setIcon } from "obsidian";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { notify } from "../../services/notification.service";
import { ImageService } from "../../../features/integration/services/ImageService";
import type { FSRSFlashcardItem } from "../../types";
import { stripBrTags } from "../../utils";
import {
	insertAtTextareaCursor,
	TOOLBAR_BUTTONS,
	type ToolbarButton,
	type ToolbarButtonAction,
	toggleTextareaWrap,
} from "../../../features/library/ui/editor/edit-toolbar.utils";
import { SECONDARY_BUTTON_CLASSES } from "../utils/tailwind";
import { BaseModal } from "./BaseModal";
import { MediaPickerModal } from "./MediaPickerModal";

export interface FlashcardEditorResult {
	cancelled: boolean;
	question: string;
	answer: string;
	newSourceNotePath?: string;
	aiInstruction?: string;
}

export interface FlashcardEditorModalOptions {
	mode: "add" | "edit";
	card?: FSRSFlashcardItem;
	currentFilePath: string;
	sourceNoteName?: string;
	prefillQuestion?: string;
	prefillAnswer?: string;
}

// ─── Toolbar Data ────────────────────────────────────────────────────

function getToolbarButtons(
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

function executeToolbarAction(
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

// ─── AI Assist Section ──────────────────────────────────────────────

interface AiAssistSectionProps {
	isExpanded: boolean;
	onToggle: () => void;
	value: string;
	onChange: (value: string) => void;
}

function AiAssistSection({
	isExpanded,
	onToggle,
	value,
	onChange,
}: AiAssistSectionProps) {
	const iconRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (iconRef.current) {
			setIcon(iconRef.current, isExpanded ? "chevron-down" : "chevron-right");
		}
	}, [isExpanded]);

	return (
		<div class="ep:mb-4 ep:pb-4 ep:border-b ep:border-obs-border">
			<button
				type="button"
				class="ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors ep:bg-transparent ep:border-none ep:p-0"
				aria-expanded={isExpanded}
				onClick={onToggle}
			>
				<span ref={iconRef} class="ep:w-4 ep:h-4 ep:transition-transform" />
				<span class="ep:text-ui-smaller ep:font-medium">AI Assist</span>
			</button>
			{isExpanded && (
				<div class="ep:mt-2">
					<textarea
						class="ep:w-full ep:min-h-20 ep:p-3 ep:border ep:border-obs-border ep:rounded-lg ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:resize-y ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted"
						placeholder="np. stw&oacute;rz podobne fiszki, rozwi&#324; temat, dodaj wi&#281;cej przyk&#322;ad&oacute;w..."
						value={value}
						onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
					/>
				</div>
			)}
		</div>
	);
}

// ─── Editor Field ───────────────────────────────────────────────────

interface EditorFieldProps {
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

function EditorField({
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

// ─── FlashcardEditorBody ────────────────────────────────────────────

interface FlashcardEditorBodyProps {
	app: App;
	options: FlashcardEditorModalOptions;
	imageService: ImageService;
	onSubmit: (result: FlashcardEditorResult) => void;
	onClose: () => void;
	onOpenMediaPicker: () => Promise<{ cancelled: boolean; markdown: string }>;
	onShowKeyboardShortcuts: () => void;
}

function FlashcardEditorBody({
	app,
	options,
	imageService,
	onSubmit,
	onClose,
	onOpenMediaPicker,
	onShowKeyboardShortcuts,
}: FlashcardEditorBodyProps) {
	const { card, mode } = options;
	const initialQuestion = card?.question || options.prefillQuestion || "";
	const initialAnswer = card?.answer || options.prefillAnswer || "";

	const [editingField, setEditingField] = useState<
		"question" | "answer" | null
	>(!initialQuestion.trim() && !initialAnswer.trim() ? "question" : null);
	const [questionValue, setQuestionValue] = useState(initialQuestion);
	const [answerValue, setAnswerValue] = useState(initialAnswer);
	const [isAiExpanded, setIsAiExpanded] = useState(false);
	const [aiInstruction, setAiInstruction] = useState("");

	// Refs for accessing latest textarea from keyboard shortcuts
	const _questionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const _answerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

	const isFormValid = questionValue.trim().length > 0;

	const buttonText = (() => {
		const hasAi = aiInstruction.trim().length > 0;
		if (mode === "add") return hasAi ? "Add & Generate" : "Add flashcard";
		return hasAi ? "Save & Generate" : "Save changes";
	})();

	const displaySourceName =
		options.card?.sourceNoteName ?? options.sourceNoteName;

	const handleSubmit = useCallback(() => {
		const question = questionValue.trim();
		const answer = answerValue.trim();
		if (!question) return;

		onSubmit({
			cancelled: false,
			question,
			answer,
			aiInstruction: aiInstruction.trim() || undefined,
		});
	}, [questionValue, answerValue, aiInstruction, onSubmit]);

	const handleImagePaste = useCallback(
		async (e: ClipboardEvent, textarea: HTMLTextAreaElement) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (item?.type.startsWith("image/")) {
					e.preventDefault();
					const blob = item.getAsFile();
					if (!blob) return;

					if (imageService.isBlobTooLarge(blob)) {
						const size = imageService.formatFileSize(blob.size);
						notify().imageTooLarge(size);
						return;
					}

					try {
						notify().imageSaving();
						const path = await imageService.saveImageFromClipboard(blob);
						const markdown = imageService.buildImageMarkdown(path);
						insertAtTextareaCursor(textarea, markdown);
						textarea.focus();

						// Sync state after insert
						const field = textarea.getAttribute("data-field");
						if (field === "question") setQuestionValue(textarea.value);
						else if (field === "answer") setAnswerValue(textarea.value);

						notify().success("Image inserted");
					} catch (error) {
						console.error("[True Recall] Failed to save pasted image:", error);
						notify().operationFailed("save image", error);
					}
					return;
				}
			}
		},
		[imageService],
	);

	const handleMediaPick = useCallback(async () => {
		const result = await onOpenMediaPicker();
		if (!result.cancelled && result.markdown) {
			// Find active textarea element in the DOM
			const activeEl = document.activeElement;
			let textarea: HTMLTextAreaElement | null = null;

			if (
				activeEl instanceof HTMLTextAreaElement &&
				activeEl.hasAttribute("data-field")
			) {
				textarea = activeEl;
			} else {
				// Fall back to first available textarea
				textarea =
					document.querySelector<HTMLTextAreaElement>(
						"[data-field='question']",
					) ??
					document.querySelector<HTMLTextAreaElement>("[data-field='answer']");
			}

			if (textarea) {
				insertAtTextareaCursor(textarea, result.markdown);
				textarea.focus();
				const field = textarea.getAttribute("data-field");
				if (field === "question") setQuestionValue(textarea.value);
				else if (field === "answer") setAnswerValue(textarea.value);
			}
		}
	}, [onOpenMediaPicker]);

	const toolbarButtons = getToolbarButtons(
		() => void handleMediaPick(),
		onShowKeyboardShortcuts,
	);

	// Find the focused textarea's field type for keyboard shortcuts
	const findFocusedTextarea = useCallback((): HTMLTextAreaElement | null => {
		const active = document.activeElement;
		if (
			active instanceof HTMLTextAreaElement &&
			active.hasAttribute("data-field")
		) {
			return active;
		}
		return null;
	}, []);

	const executeButtonOnFocused = useCallback(
		(buttonId: string) => {
			const textarea = findFocusedTextarea();
			if (!textarea) return;

			const btn = toolbarButtons.find((b) => b.id === buttonId);
			if (btn) {
				executeToolbarAction(btn.action, textarea);
			}
		},
		[toolbarButtons, findFocusedTextarea],
	);

	// Container keyboard shortcuts
	const handleContainerKeyDown = useCallback(
		(e: KeyboardEvent) => {
			const isMod = e.metaKey || e.ctrlKey;

			if (isMod && e.key === "Enter") {
				e.preventDefault();
				if (isFormValid) handleSubmit();
				return;
			}
			if (e.key === "Escape" && !(e.target instanceof HTMLTextAreaElement)) {
				e.preventDefault();
				onClose();
				return;
			}
			if (isMod && e.key === "/") {
				e.preventDefault();
				onShowKeyboardShortcuts();
				return;
			}

			if (!findFocusedTextarea()) return;

			if (isMod && e.key === "b") {
				e.preventDefault();
				executeButtonOnFocused("bold");
				return;
			}
			if (isMod && e.key === "i") {
				e.preventDefault();
				executeButtonOnFocused("italic");
				return;
			}
			if (isMod && e.key === "k") {
				e.preventDefault();
				executeButtonOnFocused("wiki");
				return;
			}
			if (isMod && e.key === "m") {
				e.preventDefault();
				executeButtonOnFocused("math");
				return;
			}
			if (isMod && e.key === "l") {
				e.preventDefault();
				executeButtonOnFocused("list");
				return;
			}
			if (isMod && e.shiftKey && e.key === "i") {
				e.preventDefault();
				void handleMediaPick();
				return;
			}
			if (isMod && e.shiftKey && e.key.toLowerCase() === "c") {
				e.preventDefault();
				executeButtonOnFocused("codeblock");
				return;
			}
		},
		[
			isFormValid,
			handleSubmit,
			onClose,
			onShowKeyboardShortcuts,
			findFocusedTextarea,
			executeButtonOnFocused,
			handleMediaPick,
		],
	);

	return (
		<fieldset
			class="ep:border-none ep:p-0 ep:m-0"
			onKeyDown={handleContainerKeyDown}
		>
			{/* AI Assist */}
			<AiAssistSection
				isExpanded={isAiExpanded}
				onToggle={() => setIsAiExpanded((prev) => !prev)}
				value={aiInstruction}
				onChange={setAiInstruction}
			/>

			{/* Fields */}
			<div class="ep:flex ep:flex-col">
				<EditorField
					app={app}
					label="Question"
					field="question"
					value={questionValue}
					isEditing={editingField === "question"}
					sourcePath={options.currentFilePath}
					toolbarButtons={toolbarButtons}
					onStartEdit={() => setEditingField("question")}
					onSave={(val) => {
						setQuestionValue(val);
						setEditingField(null);
					}}
					onTab={() => {
						setEditingField("answer");
					}}
					onChange={setQuestionValue}
					onPaste={handleImagePaste}
				/>
				<EditorField
					app={app}
					label="Answer"
					field="answer"
					value={answerValue}
					isEditing={editingField === "answer"}
					sourcePath={options.currentFilePath}
					toolbarButtons={toolbarButtons}
					onStartEdit={() => setEditingField("answer")}
					onSave={(val) => {
						setAnswerValue(val);
						setEditingField(null);
					}}
					onTab={() => {
						setEditingField("question");
					}}
					onChange={setAnswerValue}
					onPaste={handleImagePaste}
				/>
			</div>

			{/* Source info */}
			{displaySourceName && (
				<div class="ep:flex ep:items-center ep:justify-end ep:mt-3">
					<div class="ep:flex ep:items-center ep:gap-1.5 ep:text-obs-faint ep:text-ui-smaller">
						<span>Source:</span>
						{mode === "edit" ? (
							<button
								type="button"
								class="ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-obs-muted ep:transition-all ep:hover:text-obs-normal ep:hover:underline"
								onClick={() => notify().info("Source editing is not available")}
							>
								{displaySourceName}
							</button>
						) : (
							<span class="ep:text-obs-muted">{displaySourceName}</span>
						)}
					</div>
				</div>
			)}

			{/* Buttons */}
			<div class="ep:flex ep:justify-end ep:gap-3 ep:mt-5 ep:pt-4 ep:border-t ep:border-obs-border">
				<button
					type="button"
					class={SECONDARY_BUTTON_CLASSES}
					onClick={onClose}
				>
					Cancel
				</button>
				<button
					type="button"
					class="ep:py-3 ep:px-5 ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-interactive-hover ep:disabled:opacity-50 ep:disabled:cursor-not-allowed"
					disabled={!isFormValid}
					onClick={handleSubmit}
				>
					{buttonText}
				</button>
			</div>
		</fieldset>
	);
}

// ─── FlashcardEditorModal Class ─────────────────────────────────────

export class FlashcardEditorModal extends BaseModal {
	private options: FlashcardEditorModalOptions;
	private resolvePromise: ((result: FlashcardEditorResult) => void) | null =
		null;
	private hasSubmitted = false;
	private imageService: ImageService | null = null;
	private unmountBody?: () => void;

	constructor(app: App, options: FlashcardEditorModalOptions) {
		super(app, {
			title: options.mode === "add" ? "Add New Flashcard" : "Edit Flashcard",
			width: "600px",
		});
		this.options = options;
	}

	async openAndWait(): Promise<FlashcardEditorResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		this.imageService = new ImageService(this.app);
		super.onOpen();
		this.contentEl.addClass("true-recall-flashcard-editor-modal");
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<FlashcardEditorBody
				app={this.app}
				options={this.options}
				imageService={this.imageService as ImageService}
				onSubmit={(result) => {
					this.hasSubmitted = true;
					if (this.resolvePromise) {
						this.resolvePromise(result);
						this.resolvePromise = null;
					}
					this.close();
				}}
				onClose={() => this.close()}
				onOpenMediaPicker={async () => {
					const modal = new MediaPickerModal(this.app, {
						currentFilePath: this.options.currentFilePath,
					});
					return modal.openAndWait();
				}}
				onShowKeyboardShortcuts={() => {
					new KeyboardShortcutsModal(this.app).open();
				}}
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
				question: "",
				answer: "",
			});
			this.resolvePromise = null;
		}
	}
}

// ─── KeyboardShortcutsModal ─────────────────────────────────────────

const KEYBOARD_SHORTCUTS = [
	{ key: "Ctrl+Enter", action: "Save and close" },
	{ key: "Escape", action: "Cancel" },
	{ key: "Tab", action: "Switch between Question/Answer" },
	{ key: "Ctrl+B", action: "Bold (**text**)" },
	{ key: "Ctrl+I", action: "Italic (*text*)" },
	{ key: "Ctrl+K", action: "Wiki link ([[link]])" },
	{ key: "Ctrl+M", action: "Math ($$formula$$)" },
	{ key: "Ctrl+L", action: "List item (- )" },
	{ key: "Ctrl+Shift+C", action: "Code block (```code```)" },
	{ key: "Ctrl+Shift+I", action: "Insert media (image/video)" },
	{ key: "Ctrl+V", action: "Paste (images auto-saved)" },
	{ key: "Ctrl+/", action: "Show this help" },
];

function KeyboardShortcutsBody() {
	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			{KEYBOARD_SHORTCUTS.map((shortcut) => (
				<div
					key={shortcut.key}
					class="ep:flex ep:justify-between ep:items-center ep:py-2 ep:px-3 ep:bg-obs-secondary ep:rounded-md"
				>
					<span class="ep:py-1 ep:px-2 ep:bg-obs-border ep:rounded ep:font-mono ep:text-ui-smaller ep:font-medium ep:text-obs-normal">
						{shortcut.key}
					</span>
					<span class="ep:text-ui-small ep:text-obs-normal">
						{shortcut.action}
					</span>
				</div>
			))}
		</div>
	);
}

export class KeyboardShortcutsModal extends BaseModal {
	private unmountBody?: () => void;

	constructor(app: App) {
		super(app, {
			title: "Keyboard Shortcuts",
			width: "500px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(<KeyboardShortcutsBody />, container);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}
}
