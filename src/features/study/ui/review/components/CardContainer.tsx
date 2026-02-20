import { Platform } from "obsidian";
import { useCallback, useRef, useState } from "preact/hooks";
import { UI_CONFIG } from "../../../../../shared/constants";
import type { EditModeState } from "../../../../../shared/store";
import type { FSRSFlashcardItem } from "../../../../../shared/types";
import { stripBrTags } from "../../../../../shared/utils";
import { useMarkdown } from "../../../../../shared/ui/preact/hooks";
import { EditableField } from "./EditableField";

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
	onOpenSourceNote: () => void;
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

	const containerCls = `true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:p-2 ep:mt-8 ep:overflow-y-auto${isEditing ? " true-recall-review-card-container--editing" : ""}`;

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
		<button
			type="button"
			class={`${containerCls} ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-left ep:w-full`}
			onClick={handleContainerClick}
		>
			<div class="ep:w-full ep:text-center">
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
						<div class="ep:border-t ep:border-obs-border ep:my-6" />
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

				{isAnswerRevealed && !isEditing && (
					<>
						{card.sourceNoteName && (
							<div class="ep:mt-6 ep:text-center">
								<button
									type="button"
									class="ep:text-obs-accent ep:text-ui-small ep:cursor-pointer ep:no-underline ep:hover:underline ep:transition-colors ep:bg-transparent ep:border-none ep:p-0"
									onClick={onOpenSourceNote}
								>
									{card.sourceNoteName}
								</button>
							</div>
						)}
						{card.projects && card.projects.length > 0 && (
							<ProjectBadges projects={card.projects} cardId={card.id} />
						)}
					</>
				)}
			</div>
		</button>
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

function ProjectBadges({
	projects,
	cardId: _cardId,
}: {
	projects: string[];
	cardId: string;
}) {
	const [expanded, setExpanded] = useState(false);

	if (!expanded) {
		return (
			<div class="ep:mt-6 ep:flex ep:flex-col ep:items-center">
				<button
					type="button"
					class="ep:text-ui-small ep:text-obs-muted ep:cursor-pointer ep:hover:text-obs-normal ep:hover:underline ep:transition-colors ep:bg-transparent ep:border-none ep:p-0"
					onClick={() => setExpanded(true)}
				>
					Show projects ({projects.length})
				</button>
			</div>
		);
	}

	return (
		<div class="ep:mt-6 ep:flex ep:flex-col ep:items-center">
			<div class="ep:flex ep:flex-wrap ep:justify-center ep:gap-2">
				{projects.map((project) => (
					<span
						key={project}
						class="ep:text-obs-accent ep:text-ui-smaller ep:cursor-pointer ep:no-underline ep:hover:underline ep:transition-colors"
					>
						{project}
					</span>
				))}
			</div>
		</div>
	);
}
