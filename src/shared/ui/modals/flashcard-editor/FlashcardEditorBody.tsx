import type { ImageService } from "@features/integration/services/ImageService";
import { insertAtTextareaCursor } from "@features/library/ui/editor/edit-toolbar.utils";
import { notify } from "@shared/services/notification.service";
import type {
	FlashcardEditorModalOptions,
	FlashcardEditorResult,
} from "@shared/ui/modals/FlashcardEditorModal";
import { AiAssistSection } from "@shared/ui/modals/flashcard-editor/AiAssistSection";
import {
	EditorField,
	getToolbarButtons,
} from "@shared/ui/modals/flashcard-editor/EditorField";
import { useEditorKeyboard } from "@shared/ui/modals/flashcard-editor/useEditorKeyboard";
import { useImagePaste } from "@shared/ui/modals/flashcard-editor/useImagePaste";
import { SECONDARY_BUTTON_CLASSES } from "@shared/ui/utils/tailwind";
import type { App } from "obsidian";
import { useCallback, useState } from "preact/hooks";

export interface FlashcardEditorBodyProps {
	app: App;
	options: FlashcardEditorModalOptions;
	imageService: ImageService;
	onSubmit: (result: FlashcardEditorResult) => void;
	onClose: () => void;
	onOpenMediaPicker: () => Promise<{ cancelled: boolean; markdown: string }>;
	onShowKeyboardShortcuts: () => void;
}

export function FlashcardEditorBody({
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

	const handleImagePaste = useImagePaste(
		imageService,
		setQuestionValue,
		setAnswerValue,
	);

	const handleMediaPick = useCallback(async () => {
		const result = await onOpenMediaPicker();
		if (!result.cancelled && result.markdown) {
			const activeEl = document.activeElement;
			let textarea: HTMLTextAreaElement | null = null;

			if (
				activeEl instanceof HTMLTextAreaElement &&
				activeEl.hasAttribute("data-field")
			) {
				textarea = activeEl;
			} else {
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

	const handleContainerKeyDown = useEditorKeyboard({
		isFormValid,
		handleSubmit,
		onClose,
		onShowKeyboardShortcuts,
		toolbarButtons,
		handleMediaPick,
	});

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
