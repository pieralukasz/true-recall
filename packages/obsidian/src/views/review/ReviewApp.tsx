import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import type { Grade } from "ts-fsrs";

import type {
	FSRSFlashcardItem,
	LocalAnswerAssessment,
	ReviewSessionTopUp,
	ReviewSessionTopUpAvailability,
	SemanticGradingResult,
} from "@true-recall/core/types";

import type { PresetPickerOption } from "@true-recall/obsidian/features/study/ui/review/components";
import {
	ButtonBar,
	CardContainer,
	ReviewHeader,
	ReviewUserComment,
	SummaryScreen,
	WaitingScreen,
} from "@true-recall/obsidian/features/study/ui/review/components";
import type { TypeInMode } from "@true-recall/obsidian/features/study/ui/review/helpers/type-in-flow";
import { useKeyboardInset } from "@true-recall/obsidian/preact/useKeyboardInset";
import type { AppStore, ReviewApi } from "@true-recall/obsidian/store";
import { cn } from "@true-recall/obsidian/utils/cn";

// Re-export for consumers that import from this file
export { ReviewEmptyState } from "@true-recall/obsidian/features/study/ui/review/components";

// ─── Props ───────────────────────────────────────────────────────────────────

interface ReviewAppProps {
	store: AppStore;
	onShowAnswer: () => void;
	onAnswer: (rating: Grade) => void;
	onTypedAnswerChange: (value: string) => void;
	onAskFollowUp?: (question: string) => boolean;
	getQueuedFollowUpCount: () => number;
	onOpenAssistantInbox: () => void;
	onContentChange: (value: string, field: "question" | "answer") => void;
	onOpenSourceNote: () => void;
	onEditComment: () => void;
	onRemoveComment: () => void;
	onClose: () => void;
	onNextSession: () => void;
	onOpenDashboard: () => void;
	getTopUpAvailability: () => ReviewSessionTopUpAvailability;
	onTopUp: (topUp: ReviewSessionTopUp) => Promise<boolean>;
	onEndSession: () => void;
	onActionsMenu: (e: MouseEvent) => void;
	onPolishMenu?: (e: MouseEvent) => void;
	isCustomSession: boolean;
	crammingMode: boolean;
	rModeActive: boolean;
	showHeader: boolean;
	showHeaderStats: boolean;
	showNextReviewTime: boolean;
	continuousCustomReviews: boolean;
	onCycleTypeInMode: () => void;
	getTypeInState: (
		card: FSRSFlashcardItem,
		isAnswerRevealed: boolean,
	) => {
		typeInMode: TypeInMode;
		useTypeInMode: boolean;
		typedAnswer: string;
		isCheckingAnswer: boolean;
		isRatingLocked: boolean;
		localAssessment: LocalAnswerAssessment | null;
		semanticResult: SemanticGradingResult | null;
		semanticMessage: string | null;
		suggestedRating: Grade | null;
	};
	getPresetName?: (card: FSRSFlashcardItem) => string;
	getPresetOptions?: () => PresetPickerOption[];
	getLeechThreshold?: (card: FSRSFlashcardItem) => number;
	onPresetChange?: (presetName: string) => void;
	resolveAudioPath?: (card: FSRSFlashcardItem) => string | undefined;
}

// ─── Main App ────────────────────────────────────────────────────────────────

export function ReviewApp(props: ReviewAppProps) {
	const review = props.store.getState().review;

	const [, setTick] = useState(0);
	useEffect(() => {
		return props.store.subscribe(
			(state) => state.review,
			() => setTick((t) => t + 1),
		);
	}, [props.store]);

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
					onOpenDashboard={props.onOpenDashboard}
					rModeActive={props.rModeActive}
					getTopUpAvailability={props.getTopUpAvailability}
					onTopUp={props.onTopUp}
					queuedFollowUpCount={props.getQueuedFollowUpCount()}
					onOpenAssistantInbox={props.onOpenAssistantInbox}
				/>
			);
		case "waiting":
			return (
				<WaitingScreen
					review={review}
					timeUntilDue={phase.timeUntilDue}
					onEndSession={props.onEndSession}
					rModeActive={props.rModeActive}
					getTopUpAvailability={props.getTopUpAvailability}
					onTopUp={props.onTopUp}
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
	onTypedAnswerChange,
	onAskFollowUp,
	getQueuedFollowUpCount,
	onContentChange,
	onOpenSourceNote,
	onEditComment,
	onRemoveComment,
	onClose: _onClose,
	onActionsMenu,
	onPolishMenu,
	crammingMode,
	showHeader,
	showHeaderStats,
	showNextReviewTime,
	rModeActive,
	onCycleTypeInMode,
	getTypeInState,
	getPresetName,
	getPresetOptions,
	getLeechThreshold,
	onPresetChange,
	resolveAudioPath,
}: ActiveReviewProps) {
	const hasAnswer = !!card.answer?.trim();
	const isAnswerRevealed = !hasAnswer || review.isAnswerRevealed;
	const presetName = getPresetName?.(card);
	const presetOptions = getPresetOptions?.();
	const leechThreshold = getLeechThreshold?.(card);
	const typeInState = getTypeInState(card, isAnswerRevealed);
	const audioPath = resolveAudioPath?.(card);
	const isKeyboardOpen = useKeyboardInset();

	useLayoutEffect(() => {
		if (!hasAnswer && !review.isAnswerRevealed) {
			onShowAnswer();
		}
	}, [card.id, hasAnswer, review.isAnswerRevealed, onShowAnswer]);

	return (
		<div
			class={cn(
				"true-recall-review ep:relative ep:flex ep:flex-col ep:h-full ep:p-0",
				isKeyboardOpen && "is-keyboard-open",
			)}
		>
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
				leechThreshold={leechThreshold}
				onPresetChange={onPresetChange}
				audioPath={audioPath}
				typeIn={{
					enabled: typeInState.useTypeInMode,
					typedAnswer: typeInState.typedAnswer,
					onTypedAnswerChange,
					onShowAnswer,
					isCheckingAnswer: typeInState.isCheckingAnswer,
					localAssessment: typeInState.localAssessment,
					semanticResult: typeInState.semanticResult,
					semanticMessage: typeInState.semanticMessage,
					onAskFollowUp,
					queuedFollowUpCount: getQueuedFollowUpCount(),
				}}
			/>

			<ReviewUserComment
				comment={card.userComment}
				onEdit={onEditComment}
				onRemove={onRemoveComment}
			/>

			<ButtonBar
				isAnswerRevealed={isAnswerRevealed}
				preview={review.getSchedulingPreview()}
				showNextReviewTime={showNextReviewTime}
				rModeActive={rModeActive}
				typeInMode={typeInState.typeInMode}
				isRatingLocked={typeInState.isRatingLocked}
				isCheckingAnswer={typeInState.isCheckingAnswer}
				suggestedRating={typeInState.suggestedRating}
				onShowAnswer={onShowAnswer}
				onAnswer={onAnswer}
				onCycleTypeInMode={onCycleTypeInMode}
				onActionsMenu={onActionsMenu}
				onPolishMenu={onPolishMenu}
			/>
		</div>
	);
}
