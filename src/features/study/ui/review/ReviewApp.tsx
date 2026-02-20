import { useEffect, useState } from "preact/hooks";
import type { Grade } from "ts-fsrs";
import type { ReviewApi } from "../../../../shared/store";
import type { FSRSFlashcardItem } from "../../../../shared/types";
import { usePlugin } from "../../../../shared/ui/preact/ObsidianContext";
import {
	ButtonBar,
	CardContainer,
	ReviewHeader,
	SummaryScreen,
	WaitingScreen,
} from "./components";

// Re-export for consumers that import from this file
export { ReviewEmptyState } from "./components";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ReviewAppProps {
	onShowAnswer: () => void;
	onAnswer: (rating: Grade) => void;
	onStartEdit: (field: "question" | "answer") => void;
	onSaveEdit: (
		textarea: HTMLTextAreaElement,
		field: "question" | "answer",
	) => void;
	onImagePaste: (file: File, textarea: HTMLTextAreaElement) => void;
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
	onStartEdit,
	onSaveEdit,
	onImagePaste,
	onOpenSourceNote,
	onClose: _onClose,
	onActionsMenu,
	crammingMode,
	showHeader,
	showHeaderStats,
	showNextReviewTime,
}: ActiveReviewProps) {
	const editState = review.getEditState();
	const isAnswerRevealed = review.isAnswerRevealed;
	const isEditing = editState.active;

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
				editState={editState}
				isAnswerRevealed={isAnswerRevealed}
				onStartEdit={onStartEdit}
				onSaveEdit={onSaveEdit}
				onImagePaste={onImagePaste}
				onOpenSourceNote={onOpenSourceNote}
			/>

			{!isEditing && (
				<ButtonBar
					isAnswerRevealed={isAnswerRevealed}
					preview={review.getSchedulingPreview()}
					showNextReviewTime={showNextReviewTime}
					onShowAnswer={onShowAnswer}
					onAnswer={onAnswer}
					onActionsMenu={onActionsMenu}
				/>
			)}
		</div>
	);
}
