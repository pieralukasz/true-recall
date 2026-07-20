import type { App } from "obsidian";
import { render } from "preact";
import { useEffect } from "preact/hooks";

import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { ErrorBoundary } from "@true-recall/obsidian/components/ErrorBoundary";
import { ButtonBar } from "@true-recall/obsidian/features/study/ui/review/components";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";

import { PreviewCardBody } from "./PreviewCardBody";
import { resolvePreviewKeyAction } from "./preview-keyboard";
import {
	clearPreviewingCard,
	setPreviewingCard,
	VIEW_TRANSITION_NAME,
	withViewTransition,
} from "./preview-signal";
import { useCardPreview } from "./useCardPreview";

interface PreviewModalBodyProps {
	card: FSRSFlashcardItem;
	sourcePath: string;
	onClose: () => void;
}

export function PreviewModalBody({
	card,
	sourcePath,
	onClose,
}: PreviewModalBodyProps) {
	const plugin = usePlugin();
	const { isAnswerRevealed, preview, isGradable, reveal, grade } =
		useCardPreview({ card, onClose });

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			const action = resolvePreviewKeyAction({
				key: e.key,
				isAnswerRevealed,
				isGradable,
			});
			if (action.type === "noop") return;
			e.preventDefault();
			if (action.type === "close") onClose();
			else if (action.type === "reveal") reveal();
			else if (action.type === "grade") grade(action.rating);
		}
		activeDocument.addEventListener("keydown", onKey);
		return () => activeDocument.removeEventListener("keydown", onKey);
	}, [isAnswerRevealed, isGradable, reveal, grade, onClose]);

	return (
		<div
			class="true-recall-card-preview-modal"
			style={{ viewTransitionName: VIEW_TRANSITION_NAME }}
		>
			<div class="ep:w-full">
				<PreviewCardBody card={card} side="question" sourcePath={sourcePath} />

				{isAnswerRevealed && (
					<>
						<div class="ep:flex ep:items-center ep:my-8">
							<div class="ep:flex-1 ep:border-t ep:border-obs-border" />
						</div>
						<PreviewCardBody
							card={card}
							side="answer"
							sourcePath={sourcePath}
						/>
					</>
				)}
			</div>

			<div class="ep:flex ep:flex-col ep:gap-3 ep:border-t ep:border-obs-border ep:mt-6 ep:pt-4">
				<ButtonBar
					isAnswerRevealed={isAnswerRevealed}
					preview={preview}
					showNextReviewTime={plugin.settings.showNextReviewTime}
					isRatingLocked={!isGradable}
					compact
					onShowAnswer={reveal}
					onAnswer={grade}
				/>

				{isAnswerRevealed && !isGradable && (
					<div class="ep:rounded-md ep:bg-obs-modifier-hover ep:px-3 ep:py-2 ep:text-center ep:text-ui-smaller ep:text-obs-muted">
						Suspended or buried — grading disabled.
					</div>
				)}
			</div>
		</div>
	);
}

class CardPreviewModal extends BaseModal {
	constructor(
		app: App,
		private readonly plugin: TrueRecallPlugin,
		private readonly card: FSRSFlashcardItem,
		private readonly sourcePath: string,
	) {
		super(app, {
			title: "Preview",
			width: "640px",
			modifierClass: "tr-modal-card-preview",
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<ErrorBoundary>
					<PreviewModalBody
						card={this.card}
						sourcePath={this.sourcePath}
						onClose={() => this.close()}
					/>
				</ErrorBoundary>
			</ObsidianProvider>,
			container,
		);
	}

	onClose(): void {
		super.onClose();
		withViewTransition(() => clearPreviewingCard());
	}
}

export function openCardPreviewModal(
	app: App,
	plugin: TrueRecallPlugin,
	card: FSRSFlashcardItem,
	sourcePath: string,
): void {
	withViewTransition(() => {
		setPreviewingCard(card.id);
		new CardPreviewModal(app, plugin, card, sourcePath).open();
	});
}
