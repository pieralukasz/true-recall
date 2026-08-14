import type { FlashcardItem } from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { MarkdownContent } from "@true-recall/obsidian/components/MarkdownContent";
import type { PanelCardActionHandlers } from "@true-recall/obsidian/features/library/ui/panel/panel.types";
import { PreviewCardBody } from "@true-recall/obsidian/features/library/ui/panel/preview/PreviewCardBody";
import { LivePreviewField } from "@true-recall/obsidian/features/study/ui/review/components/LivePreviewField";

export function PanelCardFields({
	card,
	fsrsCard,
	sourcePath,
	actions,
}: {
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
	sourcePath: string;
	actions: PanelCardActionHandlers;
}) {
	return (
		<>
			<CardField
				label="Question"
				card={card}
				fsrsCard={fsrsCard}
				side="question"
				sourcePath={sourcePath}
				actions={actions}
			/>
			<CardField
				label="Answer"
				card={card}
				fsrsCard={fsrsCard}
				side="answer"
				sourcePath={sourcePath}
				actions={actions}
			/>
			{fsrsCard ? <SchedulingDetails card={fsrsCard} /> : null}
		</>
	);
}

function CardField({
	label,
	card,
	fsrsCard,
	side,
	sourcePath,
	actions,
}: {
	label: string;
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
	side: "question" | "answer";
	sourcePath: string;
	actions: PanelCardActionHandlers;
}) {
	const content = side === "question" ? card.question : card.answer;
	const isInlineEditable =
		fsrsCard &&
		!["cloze", "image-occlusion", "note-review"].includes(
			fsrsCard.cardType ?? "basic",
		);

	return (
		<section class="tr-panel-detail-field ep:border-b ep:border-obs-border/50">
			<div class="ep:px-3 ep:pt-2.5 ep:text-[10px] ep:font-semibold ep:uppercase ep:tracking-wider ep:text-obs-muted">
				{label}
			</div>
			{isInlineEditable ? (
				<LivePreviewField
					key={`${card.id}:${side}`}
					content={content}
					field={side}
					sourcePath={sourcePath}
					cls="tr-panel-card-editor ep:px-3 ep:pb-3 ep:pt-1.5 ep:text-obs-normal"
					onContentChange={(value, field) =>
						actions.onUpdateContent(card, value, field)
					}
				/>
			) : fsrsCard ? (
				<div class="ep:px-3 ep:pb-3 ep:pt-1.5">
					<PreviewCardBody
						card={fsrsCard}
						side={side}
						sourcePath={sourcePath}
					/>
				</div>
			) : (
				<MarkdownContent
					markdown={content}
					filePath={sourcePath}
					class="ep:px-3 ep:pb-3 ep:pt-1.5 ep:text-ui-small ep:leading-relaxed ep:text-obs-normal ep:break-words"
				/>
			)}
		</section>
	);
}

function SchedulingDetails({ card }: { card: FSRSFlashcardItem }) {
	return (
		<details class="ep:border-b ep:border-obs-border/50 ep:px-3 ep:py-2">
			<summary class="ep:cursor-pointer ep:text-ui-small ep:text-obs-muted ep:touch-manipulation">
				Scheduling Details
			</summary>
			<div class="ep:mt-3 ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-2 ep:text-ui-smaller ep:tabular-nums">
				<DetailValue label="Due" value={formatDate(card.fsrs.due)} />
				<DetailValue label="Reviews" value={String(card.fsrs.reps)} />
				<DetailValue
					label="Stability"
					value={`${card.fsrs.stability.toFixed(1)} d`}
				/>
				<DetailValue
					label="Difficulty"
					value={card.fsrs.difficulty.toFixed(1)}
				/>
				<DetailValue label="Lapses" value={String(card.fsrs.lapses)} />
				<DetailValue
					label="Last Review"
					value={
						card.fsrs.lastReview ? formatDate(card.fsrs.lastReview) : "Never"
					}
				/>
			</div>
		</details>
	);
}

function DetailValue({ label, value }: { label: string; value: string }) {
	return (
		<>
			<span class="ep:text-obs-muted">{label}</span>
			<span class="ep:text-right ep:text-obs-normal">{value}</span>
		</>
	);
}

const DETAIL_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
	year: "numeric",
	month: "short",
	day: "numeric",
});

function formatDate(value: string): string {
	return DETAIL_DATE_FORMAT.format(new Date(value));
}
