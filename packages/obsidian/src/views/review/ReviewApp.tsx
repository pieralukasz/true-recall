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

interface ReviewActions {
	onShowAnswer: () => void;
	onAnswer: (rating: Grade) => void;
	onTypedAnswerChange: (value: string) => void;
	onAskFollowUp?: (question: string) => boolean;
	onOpenAssistantInbox: () => void;
	onContentChange: (value: string, field: "question" | "answer") => void;
	onOpenSourceNote: () => void;
	onEditComment: () => void;
	onRemoveComment: () => void;
	onClose: () => void;
	onNextSession: () => void;
	onOpenDashboard: () => void;
	onTopUp: (topUp: ReviewSessionTopUp) => Promise<boolean>;
	onEndSession: () => void;
	onActionsMenu: (e: MouseEvent) => void;
	onPolishMenu?: (e: MouseEvent) => void;
	onCycleTypeInMode: () => void;
	onPresetChange?: (presetName: string) => void;
}

interface ReviewSessionState {
	kind: "standard" | "custom";
	continuous: boolean;
	cramming: boolean;
	retrievabilityMode: boolean;
	display: {
		header: boolean;
		headerStats: boolean;
		nextReviewTime: boolean;
	};
}

interface ReviewCardAdapter {
	getQueuedFollowUpCount: () => number;
	getTopUpAvailability: () => ReviewSessionTopUpAvailability;
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
	resolveAudioPath?: (card: FSRSFlashcardItem) => string | undefined;
}

interface ReviewAppModel {
	store: AppStore;
	session: ReviewSessionState;
	actions: ReviewActions;
	card: ReviewCardAdapter;
}

interface ReviewAppProps {
	model: ReviewAppModel;
}

// ─── Main App ────────────────────────────────────────────────────────────────

export function ReviewApp({ model }: ReviewAppProps) {
	const review = model.store.getState().review;

	const [, setTick] = useState(0);
	useEffect(() => {
		return model.store.subscribe(
			(state) => state.review,
			() => setTick((t) => t + 1),
		);
	}, [model.store]);

	const phase = review.getPhase();

	switch (phase.type) {
		case "idle":
			return null;
		case "complete":
			return (
				<SummaryScreen
					review={review}
					isCustomSession={model.session.kind === "custom"}
					continuousCustomReviews={model.session.continuous}
					onClose={model.actions.onClose}
					onNextSession={model.actions.onNextSession}
					onOpenDashboard={model.actions.onOpenDashboard}
					rModeActive={model.session.retrievabilityMode}
					getTopUpAvailability={model.card.getTopUpAvailability}
					onTopUp={model.actions.onTopUp}
					queuedFollowUpCount={model.card.getQueuedFollowUpCount()}
					onOpenAssistantInbox={model.actions.onOpenAssistantInbox}
				/>
			);
		case "waiting":
			return (
				<WaitingScreen
					review={review}
					timeUntilDue={phase.timeUntilDue}
					onEndSession={model.actions.onEndSession}
					rModeActive={model.session.retrievabilityMode}
					getTopUpAvailability={model.card.getTopUpAvailability}
					onTopUp={model.actions.onTopUp}
				/>
			);
		case "active":
			return <ActiveReview card={phase.card} review={review} model={model} />;
	}
}

// ─── Active Review Screen ────────────────────────────────────────────────────

interface ActiveReviewProps extends ReviewAppProps {
	card: FSRSFlashcardItem;
	review: ReviewApi;
}

function ActiveReview({ card, review, model }: ActiveReviewProps) {
	const { actions, session, card: cardAdapter } = model;
	const hasAnswer = !!card.answer?.trim();
	const isAnswerRevealed = !hasAnswer || review.isAnswerRevealed;
	const presetName = cardAdapter.getPresetName?.(card);
	const presetOptions = cardAdapter.getPresetOptions?.();
	const leechThreshold = cardAdapter.getLeechThreshold?.(card);
	const typeInState = cardAdapter.getTypeInState(card, isAnswerRevealed);
	const audioPath = cardAdapter.resolveAudioPath?.(card);
	const isKeyboardOpen = useKeyboardInset();

	useLayoutEffect(() => {
		if (!hasAnswer && !review.isAnswerRevealed) {
			actions.onShowAnswer();
		}
	}, [card.id, hasAnswer, review.isAnswerRevealed, actions]);

	return (
		<div
			class={cn(
				"true-recall-review ep:relative ep:flex ep:flex-col ep:h-full ep:p-0",
				isKeyboardOpen && "is-keyboard-open",
			)}
		>
			{session.display.header && (
				<ReviewHeader
					review={review}
					showStats={session.display.headerStats}
					crammingMode={session.cramming}
				/>
			)}

			<CardContainer
				card={card}
				isAnswerRevealed={isAnswerRevealed}
				onContentChange={actions.onContentChange}
				onOpenSourceNote={actions.onOpenSourceNote}
				presetName={presetName}
				presetOptions={presetOptions}
				leechThreshold={leechThreshold}
				onPresetChange={actions.onPresetChange}
				audioPath={audioPath}
				typeIn={{
					enabled: typeInState.useTypeInMode,
					typedAnswer: typeInState.typedAnswer,
					onTypedAnswerChange: actions.onTypedAnswerChange,
					onShowAnswer: actions.onShowAnswer,
					isCheckingAnswer: typeInState.isCheckingAnswer,
					localAssessment: typeInState.localAssessment,
					semanticResult: typeInState.semanticResult,
					semanticMessage: typeInState.semanticMessage,
					onAskFollowUp: actions.onAskFollowUp,
					queuedFollowUpCount: cardAdapter.getQueuedFollowUpCount(),
				}}
			/>

			<ReviewUserComment
				comment={card.userComment}
				onEdit={actions.onEditComment}
				onRemove={actions.onRemoveComment}
			/>

			<ButtonBar
				isAnswerRevealed={isAnswerRevealed}
				preview={review.getSchedulingPreview()}
				showNextReviewTime={session.display.nextReviewTime}
				rModeActive={session.retrievabilityMode}
				typeInMode={typeInState.typeInMode}
				isRatingLocked={typeInState.isRatingLocked}
				isCheckingAnswer={typeInState.isCheckingAnswer}
				suggestedRating={typeInState.suggestedRating}
				onShowAnswer={actions.onShowAnswer}
				onAnswer={actions.onAnswer}
				onCycleTypeInMode={actions.onCycleTypeInMode}
				onActionsMenu={actions.onActionsMenu}
				onPolishMenu={actions.onPolishMenu}
			/>
		</div>
	);
}
