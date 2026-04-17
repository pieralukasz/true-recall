import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { MarkdownContent } from "@true-recall/obsidian/components/MarkdownContent";

import { IOCardRenderer } from "@true-recall/plugins/image-occlusion";

interface PreviewCardBodyProps {
	card: FSRSFlashcardItem;
	side: "question" | "answer";
	sourcePath: string;
}

export function PreviewCardBody({
	card,
	side,
	sourcePath,
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
			/>
		);
	}

	if (card.cardType === "note-review") {
		return (
			<div class="ep:text-obs-normal ep:text-ui-medium">
				{side === "question"
					? (card.sourceNoteName ?? "Note Review")
					: "Whole-note review — open source note to read."}
			</div>
		);
	}

	const content = side === "question" ? card.question : (card.answer ?? "");
	if (!content.trim()) {
		return (
			<div class="ep:text-obs-muted ep:italic ep:text-ui-small">
				{side === "question" ? "No question" : "No answer"}
			</div>
		);
	}

	return (
		<MarkdownContent
			markdown={content}
			filePath={sourcePath}
			class="true-recall-preview-body ep:text-obs-normal"
		/>
	);
}
