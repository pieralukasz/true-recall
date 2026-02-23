import { EditableField } from "@features/study/ui/review/components/EditableField";
import { UI_CONFIG } from "@shared/constants";
import type { EditModeState } from "@shared/store";
import type { FSRSFlashcardItem } from "@shared/types";
import { Clickable } from "@shared/ui/components";
import { useMarkdown } from "@shared/ui/preact/hooks";
import { stripBrTags } from "@shared/utils";
import { Platform } from "obsidian";
import { useCallback, useRef } from "preact/hooks";

export interface CardContainerProps {
	card: FSRSFlashcardItem;
	editState: EditModeState;
	isAnswerRevealed: boolean;
	onStartEdit: (field: "question" | "answer") => void;
	onSaveEdit: (
		textarea: HTMLTextAreaElement,
		field: "question" | "answer",
	) => void;
	onImagePaste: (file: File, textarea: HTMLTextAreaElement) => void;
}

export function CardContainer({
	card,
	editState,
	isAnswerRevealed,
	onStartEdit,
	onSaveEdit,
	onImagePaste,
}: CardContainerProps) {
	const isEditing = editState.active;
	const isEditingQuestion = isEditing && editState.field === "question";
	const isEditingAnswer = isEditing && editState.field === "answer";
	const sourcePath = card.sourceNotePath || "";

	const containerCls = `true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto${isEditing ? " true-recall-review-card-container--editing" : ""}`;

	const handleContainerClick = useCallback(
		(e: MouseEvent) => {
			const target = e.target as HTMLElement;

			const fieldEl = target.closest<HTMLElement>("[data-field]");
			if (fieldEl) {
				const field = fieldEl.dataset.field as
					| "question"
					| "answer"
					| undefined;
				if (field) {
					const linkEl = target.closest("a.internal-link");
					if (linkEl) {
						e.preventDefault();
						e.stopPropagation();
						if (e.metaKey || e.ctrlKey) {
							onStartEdit(field);
						}
						return;
					}
					if (e.metaKey || e.ctrlKey) {
						onStartEdit(field);
					}
				}
			}
		},
		[onStartEdit],
	);

	return (
		<Clickable
			class={`${containerCls} ep:cursor-default ep:text-left ep:w-full ep:max-w-3xl`}
			onClick={handleContainerClick}
		>
			<div class="ep:w-full">
				{card.cardType === "cloze" && card.clozeIndex !== undefined && (
					<div class="ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider">
						{isEditingQuestion
							? "Editing cloze template (all cards will update)"
							: `Cloze ${card.clozeIndex}`}
					</div>
				)}
				{card.cardType === "reversed" && (
					<div class="ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider">
						Reversed
					</div>
				)}

				{isEditingQuestion ? (
					<EditableField
						content={
							card.cardType === "cloze" && card.clozeTemplate
								? card.clozeTemplate
								: card.question
						}
						field="question"
						sourcePath={sourcePath}
						isAnswerRevealed={isAnswerRevealed}
						onSave={onSaveEdit}
						onStartEdit={onStartEdit}
						onImagePaste={onImagePaste}
					/>
				) : (
					<MarkdownField
						content={stripBrTags(card.question)}
						sourcePath={sourcePath}
						field="question"
						cls="true-recall-review-question ep:text-xl ep:leading-relaxed ep:text-obs-normal ep:mb-6"
						onLongPress={() => onStartEdit("question")}
					/>
				)}

				{isAnswerRevealed && !isEditingQuestion && (
					<>
						<div class="ep:flex ep:items-center ep:my-6">
							<div class="ep:flex-1 ep:border-t ep:border-obs-border" />
							<div class="ep:mx-3 ep:w-1.5 ep:h-1.5 ep:rounded-full ep:bg-obs-faint" />
							<div class="ep:flex-1 ep:border-t ep:border-obs-border" />
						</div>
						{isEditingAnswer ? (
							<EditableField
								content={card.answer}
								field="answer"
								sourcePath={sourcePath}
								isAnswerRevealed={isAnswerRevealed}
								onSave={onSaveEdit}
								onStartEdit={onStartEdit}
								onImagePaste={onImagePaste}
							/>
						) : (
							<MarkdownField
								content={stripBrTags(card.answer)}
								sourcePath={sourcePath}
								field="answer"
								cls="true-recall-review-answer ep:text-lg ep:leading-relaxed ep:text-obs-muted"
								onLongPress={() => onStartEdit("answer")}
							/>
						)}
					</>
				)}
			</div>
		</Clickable>
	);
}

function MarkdownField({
	content,
	sourcePath,
	field,
	cls,
	onLongPress,
}: {
	content: string;
	sourcePath: string;
	field: string;
	cls: string;
	onLongPress: () => void;
}) {
	const ref = useMarkdown(content, sourcePath);
	const timerRef = useRef<number | null>(null);

	const handleTouchStart = useCallback(() => {
		timerRef.current = window.setTimeout(
			onLongPress,
			UI_CONFIG.longPressDuration,
		);
	}, [onLongPress]);

	const cancelTouch = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const touchHandlers = Platform.isMobile
		? {
				onTouchStart: handleTouchStart,
				onTouchEnd: cancelTouch,
				onTouchMove: cancelTouch,
			}
		: {};

	return (
		<div
			ref={ref}
			class={cls}
			data-field={field}
			data-source-path={sourcePath}
			{...touchHandlers}
		/>
	);
}
