import { EditableField } from "@features/study/ui/review/components/EditableField";
import { UI_CONFIG } from "@shared/constants";
import type { EditModeState } from "@shared/store";
import type { FSRSFlashcardItem } from "@shared/types";
import { Clickable } from "@shared/ui/components";
import { useMarkdown } from "@shared/ui/preact/hooks";
import { stripBrTags } from "@shared/utils";
import { Platform } from "obsidian";
import type { JSX } from "preact";
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
	onOpenSourceNote?: () => void;
}

export function CardContainer({
	card,
	editState,
	isAnswerRevealed,
	onStartEdit,
	onSaveEdit,
	onImagePaste,
	onOpenSourceNote,
}: CardContainerProps) {
	const isEditing = editState.active;
	const isEditingQuestion = isEditing && editState.field === "question";
	const isEditingAnswer = isEditing && editState.field === "answer";
	const sourcePath = card.sourceNotePath || "";

	const containerCls = `true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto${isEditing ? " true-recall-review-card-container--editing" : ""}`;

	return (
		<div class={`${containerCls} ep:w-full ep:max-w-3xl ep:mx-auto`}>
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
						onStartEdit={() => onStartEdit("question")}
					/>
				)}

				{isAnswerRevealed && !isEditingQuestion && (
					<>
						<div class="ep:flex ep:items-center ep:my-6">
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
								onStartEdit={() => onStartEdit("answer")}
							/>
						)}
					</>
				)}

				{card.sourceNoteName && isAnswerRevealed && !isEditing && onOpenSourceNote && (
					<div class="ep:flex ep:justify-center ep:pt-8">
						<Clickable
							class="ep:text-obs-faint ep:text-ui-smaller ep:no-underline ep:hover:text-obs-accent ep:hover:underline ep:transition-colors ep:p-0"
							onClick={onOpenSourceNote}
						>
							Source: {card.sourceNoteName}
						</Clickable>
					</div>
				)}
			</div>
		</div>
	);
}

function MarkdownField({
	content,
	sourcePath,
	field,
	cls,
	onStartEdit,
}: {
	content: string;
	sourcePath: string;
	field: string;
	cls: string;
	onStartEdit: () => void;
}) {
	const ref = useMarkdown(content, sourcePath);
	const timerRef = useRef<number | null>(null);

	const handleClick = useCallback(
		(e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
			if (!(e.metaKey || e.ctrlKey)) return;

			const target = e.target as HTMLElement;
			if (target.closest("a.internal-link")) return;

			onStartEdit();
		},
		[onStartEdit],
	);

	const handleTouchStart = useCallback(() => {
		timerRef.current = window.setTimeout(
			onStartEdit,
			UI_CONFIG.longPressDuration,
		);
	}, [onStartEdit]);

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
		// biome-ignore lint/a11y/noStaticElementInteractions: content area with Cmd/Ctrl+Click shortcut
		// biome-ignore lint/a11y/useKeyWithClickEvents: modifier-click only, no keyboard equivalent
		<div
			ref={ref}
			class={cls}
			data-field={field}
			data-source-path={sourcePath}
			onClick={handleClick}
			{...touchHandlers}
		/>
	);
}
