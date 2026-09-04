import { useEffect, useRef, useState } from "preact/hooks";

import type {
	FSRSFlashcardItem,
	LocalAnswerAssessment,
	SemanticGradingResult,
} from "@true-recall/core/types";

import { Clickable } from "@true-recall/obsidian/components";
import {
	type PresetPickerOption,
	PresetPopover,
} from "@true-recall/obsidian/features/study/ui/review/components";
import { LivePreviewField } from "@true-recall/obsidian/features/study/ui/review/components/LivePreviewField";
import { TypeInAssessmentPanel } from "@true-recall/obsidian/features/study/ui/review/components/TypeInAssessmentPanel";
import { TypeInCMEditor } from "@true-recall/obsidian/features/study/ui/review/components/TypeInCMEditor";
import { TypeInFollowUp } from "@true-recall/obsidian/features/study/ui/review/components/TypeInFollowUp";
import { getReviewMaxWidth } from "@true-recall/obsidian/features/study/ui/review/helpers";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/obsidian/utils/cn";
import { isMobile } from "@true-recall/obsidian/utils/platform";

import { AudioPlayButton } from "./AudioPlayButton";
import { CardCounters } from "./CardCounters";
import { NoteReviewRenderer } from "./NoteReviewRenderer";
import { IOCardRenderer } from "@true-recall/plugins/image-occlusion";

const INK_EMBED_PATTERN =
	/(?:!\[Ink(?:Drawing|Writing)\]|[?&]type=ink(?:Drawing|Writing)\b)/i;

function hasInkEmbed(content: string | undefined): boolean {
	return !!content && INK_EMBED_PATTERN.test(content);
}

function useAnswerWarmup(
	isRevealed: boolean,
	cardId: string,
): "hidden" | "warming" | "visible" {
	const warmRef = useRef(false);
	const prevCardRef = useRef(cardId);
	const [, tick] = useState(0);

	if (prevCardRef.current !== cardId) {
		prevCardRef.current = cardId;
		warmRef.current = false;
	}

	useEffect(() => {
		if (isRevealed || warmRef.current) return;

		const rafId = window.requestAnimationFrame(() => {
			warmRef.current = true;
			tick((t) => t + 1);
		});

		return () => cancelAnimationFrame(rafId);
	}, [cardId, isRevealed]);

	if (isRevealed) return "visible";
	if (warmRef.current) return "warming";
	return "hidden";
}

function CardFooter({
	card,
	isAnswerRevealed,
	presetName,
	presetOptions,
	leechThreshold,
	onPresetChange,
	onOpenSourceNote,
}: {
	card: FSRSFlashcardItem;
	isAnswerRevealed: boolean;
	presetName?: string;
	presetOptions?: PresetPickerOption[];
	leechThreshold?: number;
	onPresetChange?: (presetName: string) => void;
	onOpenSourceNote?: () => void;
}) {
	const { cardReviewShowSourceNote } = usePlugin().settings;

	const sourceNoteLink = card.sourceNoteName && onOpenSourceNote && (
		<Clickable
			class="ep:text-obs-faint ep:text-ui-smaller tr-no-faux-underline ep:hover:text-obs-accent tr-hover-faux-underline ep:transition-colors ep:p-0"
			onClick={onOpenSourceNote}
		>
			Source: {card.sourceNoteName}
		</Clickable>
	);

	if (!isAnswerRevealed && cardReviewShowSourceNote) return sourceNoteLink;
	if (!isAnswerRevealed && !cardReviewShowSourceNote) return null;

	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:gap-4 ep:pt-8">
			<CardCounters card={card} leechThreshold={leechThreshold} />
			{sourceNoteLink}
			{presetName && presetOptions && onPresetChange ? (
				<PresetPopover
					value={presetName}
					options={presetOptions}
					onChange={onPresetChange}
				/>
			) : presetName ? (
				<span class="ep:text-obs-faint ep:text-ui-smaller">
					FSRS: {presetName}
				</span>
			) : null}
		</div>
	);
}

interface TypeInState {
	enabled: boolean;
	typedAnswer: string;
	onTypedAnswerChange: (value: string) => void;
	onShowAnswer: () => void;
	isCheckingAnswer: boolean;
	localAssessment: LocalAnswerAssessment | null;
	semanticResult: SemanticGradingResult | null;
	semanticMessage: string | null;
	onAskFollowUp?: (question: string) => boolean;
	queuedFollowUpCount: number;
}

interface CardContainerProps {
	card: FSRSFlashcardItem;
	isAnswerRevealed: boolean;
	onContentChange: (value: string, field: "question" | "answer") => void;
	onOpenSourceNote?: () => void;
	presetName?: string;
	presetOptions?: PresetPickerOption[];
	leechThreshold?: number;
	onPresetChange?: (presetName: string) => void;
	typeIn: TypeInState;
	audioPath?: string;
}

export function CardContainer({
	card,
	isAnswerRevealed,
	onContentChange,
	onOpenSourceNote,
	presetName,
	presetOptions,
	leechThreshold,
	onPresetChange,
	typeIn,
	audioPath,
}: CardContainerProps) {
	const {
		enabled: useTypeInMode,
		typedAnswer,
		onTypedAnswerChange,
		onShowAnswer,
		isCheckingAnswer,
		localAssessment,
		semanticResult,
		semanticMessage,
		onAskFollowUp,
		queuedFollowUpCount,
	} = typeIn;
	const answerPhase = useAnswerWarmup(isAnswerRevealed, card.id);
	const sourcePath = card.sourceNotePath || "";
	const { reviewContentWidth } = usePlugin().settings;
	const containsInkEmbed =
		hasInkEmbed(card.question) || hasInkEmbed(card.answer);
	const maxWidth =
		isMobile() || containsInkEmbed
			? "100%"
			: getReviewMaxWidth(reviewContentWidth);
	const maxWidthStyle = `--tr-review-max-width: ${maxWidth}; max-width: ${maxWidth};`;

	const questionContent = card.question;
	const isCloze = card.cardType === "cloze";
	const hasTextAnswer = !!card.answer?.trim();
	const isImageOcclusion =
		card.cardType === "image-occlusion" &&
		!!card.ioImagePath &&
		!!card.ioRegionsJson;
	const isAlwaysTypeIn = card.alwaysTypeIn || card.fsrs.alwaysTypeIn;
	const showTypeIn = useTypeInMode && hasTextAnswer;
	const showAssessment =
		showTypeIn && (isCheckingAnswer || !!semanticResult || !!semanticMessage);

	if (card.cardType === "note-review") {
		return (
			<NoteReviewRenderer
				card={card}
				presetName={presetName}
				presetOptions={presetOptions}
				leechThreshold={leechThreshold}
				onPresetChange={onPresetChange}
				onOpenSourceNote={onOpenSourceNote}
			/>
		);
	}

	if (isImageOcclusion) {
		return (
			<div
				class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto ep:w-full ep:mx-auto"
				style={maxWidthStyle}
			>
				<div class="ep:w-full">
					<IOCardRenderer
						key={card.id}
						imagePath={card.ioImagePath}
						regionsJson={card.ioRegionsJson}
						templateOrd={card.templateOrd}
						revealed={isAnswerRevealed}
						revealSingleOnly
						expandable
					/>

					<CardFooter
						card={card}
						isAnswerRevealed={isAnswerRevealed}
						presetName={presetName}
						presetOptions={presetOptions}
						leechThreshold={leechThreshold}
						onPresetChange={onPresetChange}
						onOpenSourceNote={onOpenSourceNote}
					/>
				</div>
			</div>
		);
	}

	return (
		<div
			class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto ep:w-full ep:mx-auto"
			style={maxWidthStyle}
		>
			<div class="ep:w-full ep:relative">
				{card.cardType === "cloze" && card.clozeIndex !== undefined && (
					<div class="ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider">
						{`Cloze ${card.clozeIndex}`}
					</div>
				)}
				{card.cardType === "reversed" && (
					<div class="ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider">
						Reversed
					</div>
				)}
				{isAlwaysTypeIn && (
					<div class="ep:text-xs ep:text-obs-accent ep:mb-2 ep:uppercase ep:tracking-wider">
						Always type-in
					</div>
				)}

				<LivePreviewField
					content={
						// Anki-style cloze reveal: the answer replaces the sentence in
						// place (gap filled + Extra below) instead of rendering as a
						// separate basic-card answer block.
						isCloze && isAnswerRevealed
							? (card.answer ?? questionContent)
							: questionContent
					}
					field="question"
					sourcePath={sourcePath}
					cls="true-recall-review-question ep:leading-relaxed ep:text-obs-normal ep:mb-6"
					onContentChange={isCloze ? undefined : onContentChange}
				/>

				{audioPath && (
					<AudioPlayButton audioPath={audioPath} autoplay={false} />
				)}

				{showTypeIn && !isAnswerRevealed && (
					<div class="ep:mt-12 ep:mb-6">
						<TypeInCMEditor
							value={typedAnswer}
							onChange={onTypedAnswerChange}
							onSubmit={onShowAnswer}
							placeholderText="Explain in your own words…"
						/>
					</div>
				)}

				{showAssessment && (
					<TypeInAssessmentPanel
						isChecking={isCheckingAnswer}
						result={semanticResult}
						message={semanticMessage}
						fallback={localAssessment}
					/>
				)}

				{hasTextAnswer && !isCloze && (
					<>
						<div
							class={cn(
								"ep:flex ep:items-center ep:my-6",
								!isAnswerRevealed && "ep:hidden",
							)}
						>
							<div class="ep:flex-1 ep:border-t ep:border-obs-border" />
						</div>
						<div
							class={cn(
								answerPhase === "visible" && "ep:mt-6",
								answerPhase === "warming" &&
									"ep:invisible ep:absolute ep:left-0 ep:right-0 ep:pointer-events-none ep:-z-10",
								answerPhase === "hidden" && "ep:hidden",
							)}
							aria-hidden={answerPhase !== "visible"}
							inert={answerPhase !== "visible"}
						>
							<LivePreviewField
								content={card.answer}
								field="answer"
								sourcePath={sourcePath}
								cls="true-recall-review-answer ep:leading-relaxed ep:text-obs-muted"
								onContentChange={onContentChange}
							/>
						</div>
					</>
				)}

				{showTypeIn && isAnswerRevealed && onAskFollowUp && (
					<TypeInFollowUp
						onSubmit={onAskFollowUp}
						queuedCount={queuedFollowUpCount}
					/>
				)}

				<CardFooter
					card={card}
					isAnswerRevealed={isAnswerRevealed}
					presetName={presetName}
					presetOptions={presetOptions}
					leechThreshold={leechThreshold}
					onPresetChange={onPresetChange}
					onOpenSourceNote={onOpenSourceNote}
				/>
			</div>
		</div>
	);
}
