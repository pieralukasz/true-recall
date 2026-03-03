import {
	ButtonBar,
	CardContainer,
	ReviewHeader,
	SummaryScreen,
	WaitingScreen,
} from "@features/study/ui/review/components";
import type { ReviewApi } from "@shared/store";
import type { FSRSFlashcardItem } from "@shared/types";
import type { SelectOption } from "@shared/ui/components/SelectInput";
import { usePlugin } from "@shared/ui/preact/ObsidianContext";
import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import type { Grade } from "ts-fsrs";

// Re-export for consumers that import from this file
export { ReviewEmptyState } from "@features/study/ui/review/components";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ReviewAppProps {
	onShowAnswer: () => void;
	onAnswer: (rating: Grade) => void;
	onContentChange: (value: string, field: "question" | "answer") => void;
	onOpenSourceNote: () => void;
	onClose: () => void;
	onNextSession: () => void;
	onEndSession: () => void;
	onActionsMenu: (e: MouseEvent) => void;
	isCustomSession: boolean;
	crammingMode: boolean;
	showHeader: boolean;
	showHeaderStats: boolean;
	showNextReviewTime: boolean;
	continuousCustomReviews: boolean;
	getPresetName?: (card: FSRSFlashcardItem) => string;
	getPresetOptions?: () => SelectOption[];
	onPresetChange?: (presetName: string) => void;
}

// ─── Main App ────────────────────────────────────────────────────────────────

export function ReviewApp(props: ReviewAppProps) {
	const plugin = usePlugin();
	const review = plugin.store?.getState().review;

	const [, setTick] = useState(0);
	useEffect(() => {
		if (!plugin.store) return;
		return plugin.store.subscribe(
			(state) => state.review,
			() => setTick((t) => t + 1),
		);
	}, [plugin]);

	if (!review) return null;

	const phase = review.getPhase();

	switch (phase.type) {
		case "idle":
			return null;
		case "complete":
			return (
				<SummaryScreen
					review={review}
					isCustomSession={props.isCustomSession}
					continuousCustomReviews={props.continuousCustomReviews}
					onClose={props.onClose}
					onNextSession={props.onNextSession}
				/>
			);
		case "waiting":
			return (
				<WaitingScreen
					review={review}
					timeUntilDue={phase.timeUntilDue}
					onEndSession={props.onEndSession}
				/>
			);
		case "active":
			return <ActiveReview card={phase.card} review={review} {...props} />;
	}
}

// ─── Active Review Screen ────────────────────────────────────────────────────

interface ActiveReviewProps extends ReviewAppProps {
	card: FSRSFlashcardItem;
	review: ReviewApi;
}

function ActiveReview({
	card,
	review,
	onShowAnswer,
	onAnswer,
	onContentChange,
	onOpenSourceNote,
	onClose: _onClose,
	onActionsMenu,
	crammingMode,
	showHeader,
	showHeaderStats,
	showNextReviewTime,
	getPresetName,
	getPresetOptions,
	onPresetChange,
}: ActiveReviewProps) {
	const hasAnswer = !!card.answer?.trim();
	const isAnswerRevealed = !hasAnswer || review.isAnswerRevealed;
	const presetName = getPresetName?.(card);
	const presetOptions = getPresetOptions?.();

	useLayoutEffect(() => {
		if (!hasAnswer && !review.isAnswerRevealed) {
			onShowAnswer();
		}
	}, [card.id, hasAnswer]);

	return (
		<div class="true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0">
			{showHeader && (
				<ReviewHeader
					review={review}
					showStats={showHeaderStats}
					crammingMode={crammingMode}
				/>
			)}

			<CardContainer
				card={card}
				isAnswerRevealed={isAnswerRevealed}
				onContentChange={onContentChange}
				onOpenSourceNote={onOpenSourceNote}
				presetName={presetName}
				presetOptions={presetOptions}
				onPresetChange={onPresetChange}
			/>

			<ButtonBar
				isAnswerRevealed={isAnswerRevealed}
				preview={review.getSchedulingPreview()}
				showNextReviewTime={showNextReviewTime}
				onShowAnswer={onShowAnswer}
				onAnswer={onAnswer}
				onActionsMenu={onActionsMenu}
			/>
		</div>
	);
}
