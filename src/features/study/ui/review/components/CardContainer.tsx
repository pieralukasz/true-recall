import { LivePreviewField } from "@features/study/ui/review/components/LivePreviewField";
import type { FSRSFlashcardItem } from "@shared/types";
import { Clickable } from "@shared/ui/components";
import { SelectInput, type SelectOption } from "@shared/ui/components/SelectInput";
import { cn } from "@shared/ui/utils/cn";

export interface CardContainerProps {
	card: FSRSFlashcardItem;
	isAnswerRevealed: boolean;
	onContentChange: (value: string, field: "question" | "answer") => void;
	onOpenSourceNote?: () => void;
	presetName?: string;
	presetOptions?: SelectOption[];
	onPresetChange?: (presetName: string) => void;
}

export function CardContainer({
	card,
	isAnswerRevealed,
	onContentChange,
	onOpenSourceNote,
	presetName,
	presetOptions,
	onPresetChange,
}: CardContainerProps) {
	const sourcePath = card.sourceNotePath || "";

	// For cloze cards, the live-preview editor shows the cloze template
	// so users can edit {{c1::...}} syntax directly
	const questionContent =
		card.cardType === "cloze" && card.clozeTemplate
			? card.clozeTemplate
			: card.question;

	return (
		<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto ep:w-full ep:max-w-3xl ep:mx-auto">
			<div class="ep:w-full">
				{card.cardType === "cloze" && card.clozeIndex !== undefined && (
					<div class="ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider">
						{`Cloze ${card.clozeIndex}`}
					</div>
				)}
				{card.cardType === "reversed" && (
					<div class="ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider">
						Reversed
					</div>
				)}

				<LivePreviewField
					content={questionContent}
					field="question"
					sourcePath={sourcePath}
					cls="true-recall-review-question ep:leading-relaxed ep:text-obs-normal ep:mb-6"
					onContentChange={onContentChange}
				/>

				{!!card.answer?.trim() && (
					<>
						<div
							class={cn("ep:flex ep:items-center ep:my-6", !isAnswerRevealed && "ep:hidden")}
						>
							<div class="ep:flex-1 ep:border-t ep:border-obs-border" />
						</div>
						<div class={isAnswerRevealed ? "ep:mt-6" : "ep:hidden"}>
							<LivePreviewField
								content={card.answer}
								field="answer"
								sourcePath={sourcePath}
								cls="true-recall-review-answer ep:leading-relaxed ep:text-obs-muted"
								onContentChange={onContentChange}
							/>
						</div>
					</>
				)}

				{isAnswerRevealed && (card.sourceNoteName || presetName) && (
					<div class="ep:flex ep:flex-col ep:items-center ep:gap-1.5 ep:pt-8">
						{card.sourceNoteName && onOpenSourceNote && (
							<Clickable
								class="ep:text-obs-faint ep:text-ui-smaller ep:no-underline ep:hover:text-obs-accent ep:hover:underline ep:transition-colors ep:p-0"
								onClick={onOpenSourceNote}
							>
								Source: {card.sourceNoteName}
							</Clickable>
						)}
						{presetName && presetOptions && onPresetChange ? (
							<div class="ep:flex ep:items-center ep:gap-1.5 ep:text-obs-faint ep:text-ui-smaller">
								<span>FSRS:</span>
								<SelectInput
									value={presetName}
									options={presetOptions}
									onChange={onPresetChange}
								/>
							</div>
						) : presetName ? (
							<span class="ep:text-obs-faint ep:text-ui-smaller">
								FSRS: {presetName}
							</span>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}
