import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import type { Grade } from "ts-fsrs";

import type {
	FSRSFlashcardItem,
	LocalAnswerAssessment,
	SemanticGradingResult,
} from "@true-recall/core/types";

import type { PresetPickerOption } from "@true-recall/obsidian/features/study/ui/review/components";
import {
	ButtonBar,
	CardContainer,
	ReviewHeader,
	SummaryScreen,
	WaitingScreen,
} from "@true-recall/obsidian/features/study/ui/review/components";
import type { TypeInMode } from "@true-recall/obsidian/features/study/ui/review/helpers/type-in-flow";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import type { ReviewApi } from "@true-recall/obsidian/store";

// Re-export for consumers that import from this file
export { ReviewEmptyState } from "@true-recall/obsidian/features/study/ui/review/components";

// ─── Props ───────────────────────────────────────────────────────────────────

interface ReviewAppProps {
	onShowAnswer: () => void;
	onAnswer: (rating: Grade) => void;
	onTypedAnswerChange: (value: string) => void;
	onContentChange: (value: string, field: "question" | "answer") => void;
	onOpenSourceNote: () => void;
	onClose: () => void;
	onNextSession: () => void;
	onEndSession: () => void;
	onActionsMenu: (e: MouseEvent) => void;
	onPolishMenu?: (e: MouseEvent) => void;
	isCustomSession: boolean;
	crammingMode: boolean;
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
		aiEnabled: boolean;
		typedAnswer: string;
		isCheckingAnswer: boolean;
		isRatingLocked: boolean;
		localAssessment: LocalAnswerAssessment | null;
		semanticResult: SemanticGradingResult | null;
		semanticMessage: string | null;
	};
	getPresetName?: (card: FSRSFlashcardItem) => string;
	getPresetOptions?: () => PresetPickerOption[];
	onPresetChange?: (presetName: string) => void;
	resolveAudioPath?: (card: FSRSFlashcardItem) => string | undefined;
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
	onTypedAnswerChange,
	onContentChange,
	onOpenSourceNote,
	onClose: _onClose,
	onActionsMenu,
	onPolishMenu,
	crammingMode,
	showHeader,
	showHeaderStats,
	showNextReviewTime,
	onCycleTypeInMode,
	getTypeInState,
	getPresetName,
	getPresetOptions,
	onPresetChange,
	resolveAudioPath,
}: ActiveReviewProps) {
	const hasAnswer = !!card.answer?.trim();
	const isAnswerRevealed = !hasAnswer || review.isAnswerRevealed;
	const presetName = getPresetName?.(card);
	const presetOptions = getPresetOptions?.();
	const typeInState = getTypeInState(card, isAnswerRevealed);
	const audioPath = resolveAudioPath?.(card);

	useLayoutEffect(() => {
		if (!hasAnswer && !review.isAnswerRevealed) {
			onShowAnswer();
		}
	}, [card.id, hasAnswer, review.isAnswerRevealed, onShowAnswer]);

	return (
		<div class="true-recall-review ep:relative ep:flex ep:flex-col ep:h-full ep:p-0">
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
				audioPath={audioPath}
				typeIn={{
					enabled: typeInState.useTypeInMode,
					aiEnabled: typeInState.aiEnabled,
					typedAnswer: typeInState.typedAnswer,
					onTypedAnswerChange,
					onShowAnswer,
					isCheckingAnswer: typeInState.isCheckingAnswer,
					localAssessment: typeInState.localAssessment,
					semanticResult: typeInState.semanticResult,
					semanticMessage: typeInState.semanticMessage,
				}}
			/>

			<ButtonBar
				isAnswerRevealed={isAnswerRevealed}
				preview={review.getSchedulingPreview()}
				showNextReviewTime={showNextReviewTime}
				typeInMode={typeInState.typeInMode}
				isRatingLocked={typeInState.isRatingLocked}
				onShowAnswer={onShowAnswer}
				onAnswer={onAnswer}
				onCycleTypeInMode={onCycleTypeInMode}
				onActionsMenu={onActionsMenu}
				onPolishMenu={onPolishMenu}
			/>
		</div>
	);
}
