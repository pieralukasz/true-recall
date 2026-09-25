import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { MarkdownContent } from "@true-recall/obsidian/components/MarkdownContent";
import { hasBlockMarkdown } from "@true-recall/obsidian/features/study/ui/review/helpers";
import { cn } from "@true-recall/obsidian/utils/cn";

import { IOCardRenderer } from "@true-recall/plugins/image-occlusion";

interface PreviewCardBodyProps {
	card: FSRSFlashcardItem;
	side: "question" | "answer";
	sourcePath: string;
	/** Note type Styling scope class (the caller renders the `<style>`) */
	noteTypeClass?: string;
}

const BODY_CLASSES: Record<"question" | "answer", string> = {
	question: "true-recall-review-question ep:leading-relaxed ep:text-obs-normal",
	answer: "true-recall-review-answer ep:leading-relaxed ep:text-obs-muted",
};

export function PreviewCardBody({
	card,
	side,
	sourcePath,
	noteTypeClass,
}: PreviewCardBodyProps) {
	if (
		card.cardType === "image-occlusion" &&
		card.ioImagePath &&
		card.ioRegionsJson
	) {
		return (
			<IOCardRenderer
				imagePath={card.ioImagePath}
				regionsJson={card.ioRegionsJson}
				templateOrd={card.templateOrd}
				revealed={side === "answer"}
				class={noteTypeClass}
			/>
		);
	}

	if (card.cardType === "note-review") {
		return (
			<div class={`${BODY_CLASSES[side]} ep:text-ui-medium`}>
				{side === "question"
					? (card.sourceNoteName ?? "Note Review")
					: "Whole-note review — open source note to read."}
			</div>
		);
	}

	const content = side === "question" ? card.question : (card.answer ?? "");
	if (!content.trim()) {
		return (
			<div
				class={`${BODY_CLASSES[side]} ep:italic ep:text-obs-muted ep:text-ui-small`}
			>
				{side === "question" ? "No question" : "No answer"}
			</div>
		);
	}

	const wrapperClass = cn(
		BODY_CLASSES[side],
		hasBlockMarkdown(content) && "is-block-content",
		noteTypeClass,
	);

	return (
		<MarkdownContent
			markdown={content}
			filePath={sourcePath}
			class={wrapperClass}
		/>
	);
}
