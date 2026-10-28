import type { App } from "obsidian";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import { locateClozeAnswer } from "@true-recall/obsidian/features/study/ui/review/helpers/cloze-answer-ranges";
import { placeholderRanges } from "@true-recall/obsidian/features/study/ui/review/helpers/cloze-gap-ranges";
import { LivePreviewField } from "@true-recall/obsidian/features/study/ui/review/components/LivePreviewField";
import { useNoteTypeCss } from "@true-recall/obsidian/features/study/ui/review/hooks/useNoteTypeCss";
import { t } from "@true-recall/obsidian/i18n";
import { IOCardRenderer } from "@true-recall/plugins/image-occlusion";
import { cn } from "@true-recall/obsidian/utils/cn";

import type { BrowserCard } from "../types";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";

/**
 * Read-only preview of a card, laid out like the review screen: the question
 * first, then the answer replacing it once revealed.
 *
 * Nothing here writes: no `onContentChange` is passed, no session is started,
 * so no review log entry and no FSRS field is touched.
 */
function CardPreviewBody({ card }: { card: BrowserCard }) {
	const [revealed, setRevealed] = useState(false);
	const noteTypeCss = useNoteTypeCss(
		card.noteTypeId,
		card.templateOrd,
		card.cardType === "cloze",
	);
	const fieldCls = cn(
		"true-recall-card-preview-markdown",
		noteTypeCss?.className,
	);
	const isImageOcclusion =
		card.cardType === "image-occlusion" &&
		!!card.ioImagePath &&
		!!card.ioRegionsJson;

	// CM6 tags both the `[…]` gap and the text of a real markdown link with
	// `cm-link`, so CSS cannot tell them apart. Mark the placeholders by offset
	// instead: `[text]` that is neither followed by `(` nor preceded by `[`.
	const gapRanges = card.cardType === "cloze" ? placeholderRanges(card.question ?? "") : [];

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === " " || event.key === "Enter") {
				event.preventDefault();
				setRevealed(true);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const located =
		card.cardType === "cloze"
			? locateClozeAnswer(
					card.answer ?? "",
					card.clozeTemplate,
					card.clozeIndex,
				)
			: null;

	return (
		<div
			class={cn(
				"ep:flex ep:flex-col ep:gap-3",
				card.cardType === "cloze" && "is-cloze",
				revealed ? "is-answer" : "is-question",
			)}
		>
			{noteTypeCss && <style>{noteTypeCss.css}</style>}

			{isImageOcclusion ? (
				<IOCardRenderer
					imagePath={card.ioImagePath}
					regionsJson={card.ioRegionsJson}
					templateOrd={card.templateOrd}
					revealed={revealed}
					class={noteTypeCss?.className}
				/>
			) : revealed ? (
				card.answer ? (
					<LivePreviewField
						content={located ? located.text : card.answer}
						field="answer"
						sourcePath={card.sourceNotePath ?? ""}
						cls={fieldCls}
						clozeRanges={located?.ranges}
					/>
				) : (
					<div class="ep:text-sm ep:text-obs-muted ep:italic">
						{t("No answer")}
					</div>
				)
			) : card.question ? (
				<LivePreviewField
					content={card.question}
					field="question"
					sourcePath={card.sourceNotePath ?? ""}
					cls={fieldCls}
					clozeRanges={gapRanges}
				/>
			) : (
				<div class="ep:text-sm ep:text-obs-muted ep:italic">
					{t("No question")}
				</div>
			)}

			<div class="ep:flex ep:justify-end">
				{revealed ? null : (
					<Clickable
						class="mod-cta ep-btn"
						onClick={() => setRevealed(true)}
						stopPropagation={false}
					>
						{t("Show answer")}
					</Clickable>
				)}
			</div>
		</div>
	);
}

class CardPreviewModal extends BasePromiseModal<void> {
	constructor(
		app: App,
		private readonly plugin: TrueRecallPlugin,
		private readonly card: BrowserCard,
	) {
		super(app, { title: t("Preview"), width: "640px" });
	}

	protected getDefaultResult(): void {
		// Nothing to return: the preview has no side effects.
	}

	protected renderBody(container: HTMLElement): void {
		// The review components read app/plugin from context, and a modal is
		// outside the provider that the workspace mounts, so without this the
		// body renders nothing.
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<CardPreviewBody card={this.card} />
			</ObsidianProvider>,
			container,
		);
	}
}

export function openCardPreviewModal(
	app: App,
	plugin: TrueRecallPlugin,
	card: BrowserCard,
): void {
	void new CardPreviewModal(app, plugin, card).openAndWait();
}
