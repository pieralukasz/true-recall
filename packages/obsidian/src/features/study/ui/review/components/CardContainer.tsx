import type {
	FSRSFlashcardItem,
	LocalAnswerAssessment,
	SemanticGradingResult,
} from "@true-recall/core/types";
import { Clickable } from "@true-recall/obsidian/components";
import { IOCardRenderer } from "@true-recall/obsidian/features/image-occlusion/IOCardRenderer";
import {
	type PresetPickerOption,
	PresetPopover,
} from "@true-recall/obsidian/features/study/ui/review/components";
import { LivePreviewField } from "@true-recall/obsidian/features/study/ui/review/components/LivePreviewField";
import { TypeInCMEditor } from "@true-recall/obsidian/features/study/ui/review/components/TypeInCMEditor";
import { cn } from "@true-recall/obsidian/utils/cn";
import { useEffect, useRef, useState } from "preact/hooks";
import { NoteReviewRenderer } from "./NoteReviewRenderer";

// Pre-renders the answer DOM one frame after the question paints,
// but keeps it invisible (opacity:0, height:0). Without this,
// revealing the answer causes a visible layout reflow as the
// browser measures and paints the answer content for the first time.
function useAnswerWarmup(
	isRevealed: boolean,
	cardId: string,
): "hidden" | "warming" | "visible" {
	const warmRef = useRef(false);
	const prevCardRef = useRef(cardId);
	const [, tick] = useState(0);

	// Reset synchronously on card change (before render output)
	if (prevCardRef.current !== cardId) {
		prevCardRef.current = cardId;
		warmRef.current = false;
	}

	useEffect(() => {
		if (isRevealed || warmRef.current) return;

		// Wait one frame for the question to paint, then start warm-up
		const rafId = requestAnimationFrame(() => {
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
	onPresetChange,
	onOpenSourceNote,
}: {
	card: FSRSFlashcardItem;
	isAnswerRevealed: boolean;
	presetName?: string;
	presetOptions?: PresetPickerOption[];
	onPresetChange?: (presetName: string) => void;
	onOpenSourceNote?: () => void;
}) {
	if (!isAnswerRevealed || (!card.sourceNoteName && !presetName)) return null;

	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:gap-4 ep:pt-8">
			{card.sourceNoteName && onOpenSourceNote && (
				<Clickable
					class="ep:text-obs-faint ep:text-ui-smaller ep:no-underline ep:hover:text-obs-accent ep:hover:underline ep:transition-colors ep:p-0"
					onClick={onOpenSourceNote}
				>
					Source: {card.sourceNoteName}
				</Clickable>
			)}
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

export interface TypeInState {
	enabled: boolean;
	aiEnabled: boolean;
	typedAnswer: string;
	onTypedAnswerChange: (value: string) => void;
	onShowAnswer: () => void;
	isCheckingAnswer: boolean;
	localAssessment: LocalAnswerAssessment | null;
	semanticResult: SemanticGradingResult | null;
	semanticMessage: string | null;
}

export interface CardContainerProps {
	card: FSRSFlashcardItem;
	isAnswerRevealed: boolean;
	onContentChange: (value: string, field: "question" | "answer") => void;
	onOpenSourceNote?: () => void;
	presetName?: string;
	presetOptions?: PresetPickerOption[];
	onPresetChange?: (presetName: string) => void;
	typeIn: TypeInState;
}

function TokenRow({
	label,
	tokens,
	variant,
}: {
	label: string;
	tokens: Array<{ text: string; type: "match" | "missing" | "extra" }>;
	variant: "expected" | "user";
}) {
	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<span class="ep:text-ui-smaller ep:text-obs-muted">{label}</span>
			<div class="ep:flex ep:flex-wrap ep:gap-1.5">
				{tokens.length === 0 && (
					<span class="ep:text-ui-smaller ep:text-obs-faint">—</span>
				)}
				{tokens.map((token, index) => {
					const isMatch = token.type === "match";
					const isError =
						variant === "expected"
							? token.type === "missing"
							: token.type === "extra";
					return (
						<span
							key={`${token.type}-${token.text}-${index}`}
							class={cn(
								"ep:px-1.5 ep:py-0.5 ep:rounded-sm ep:text-ui-smaller",
								isMatch && "ep:bg-obs-green/20 ep:text-obs-green",
								isError && "ep:bg-obs-red/20 ep:text-obs-red",
								!isMatch && !isError && "ep:text-obs-faint",
							)}
						>
							{token.text}
						</span>
					);
				})}
			</div>
		</div>
	);
}

export function CardContainer({
	card,
	isAnswerRevealed,
	onContentChange,
	onOpenSourceNote,
	presetName,
	presetOptions,
	onPresetChange,
	typeIn,
}: CardContainerProps) {
	const {
		enabled: useTypeInMode,
		aiEnabled,
		typedAnswer,
		onTypedAnswerChange,
		onShowAnswer,
		isCheckingAnswer,
		localAssessment,
		semanticResult,
		semanticMessage,
	} = typeIn;
	const answerPhase = useAnswerWarmup(isAnswerRevealed, card.id);
	const sourcePath = card.sourceNotePath || "";

	const questionContent = card.question;
	const isCloze = card.cardType === "cloze";
	const hasTextAnswer = !!card.answer?.trim();
	const isImageOcclusion =
		card.cardType === "image-occlusion" &&
		!!card.ioImagePath &&
		!!card.ioRegionsJson;
	const isAlwaysTypeIn = card.alwaysTypeIn || card.fsrs.alwaysTypeIn;
	const showTypeIn = useTypeInMode && hasTextAnswer;

	const expectedTokens =
		localAssessment?.diff.filter((token) => token.type !== "extra") ?? [];
	const userTokens =
		localAssessment?.diff.filter((token) => token.type !== "missing") ?? [];

	if (card.cardType === "note-review") {
		return (
			<NoteReviewRenderer
				card={card}
				presetName={presetName}
				presetOptions={presetOptions}
				onPresetChange={onPresetChange}
				onOpenSourceNote={onOpenSourceNote}
			/>
		);
	}

	if (isImageOcclusion) {
		return (
			<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto ep:w-full ep:max-w-3xl ep:mx-auto">
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
						onPresetChange={onPresetChange}
						onOpenSourceNote={onOpenSourceNote}
					/>
				</div>
			</div>
		);
	}

	return (
		<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto ep:w-full ep:max-w-3xl ep:mx-auto">
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
					content={questionContent}
					field="question"
					sourcePath={sourcePath}
					cls="true-recall-review-question ep:leading-relaxed ep:text-obs-normal ep:mb-6"
					onContentChange={isCloze ? undefined : onContentChange}
				/>

				{showTypeIn && !isAnswerRevealed && (
					<div class="ep:mb-6">
						<TypeInCMEditor
							value={typedAnswer}
							onChange={onTypedAnswerChange}
							onSubmit={onShowAnswer}
							placeholderText="Type your answer in your own words, then show answer."
						/>
					</div>
				)}

				{hasTextAnswer && (
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

				{isAnswerRevealed && localAssessment && !aiEnabled && useTypeInMode && (
					<div class="true-recall-answer-assessment ep:mt-8 ep:p-4 ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-secondary/20 ep:flex ep:flex-col ep:gap-3">
						<div class="ep:flex ep:items-center ep:justify-between ep:gap-2">
							<span class="ep:text-ui-small ep:font-medium">
								Text comparison
							</span>
							<span class="ep:text-ui-smaller ep:text-obs-muted">
								{localAssessment.score}% match
							</span>
						</div>
						<TokenRow
							label="Expected answer"
							tokens={expectedTokens}
							variant="expected"
						/>
						<TokenRow label="Your answer" tokens={userTokens} variant="user" />
					</div>
				)}

				{isAnswerRevealed &&
					aiEnabled &&
					(isCheckingAnswer || !!semanticResult || !!semanticMessage) && (
						<div class="true-recall-semantic-assessment ep:mt-4 ep:p-4 ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-secondary/20 ep:flex ep:flex-col ep:gap-2">
							<div class="ep:flex ep:items-center ep:justify-between ep:gap-2">
								<span class="ep:text-ui-small ep:font-medium">
									Semantic grading
								</span>
								{isCheckingAnswer ? (
									<span class="ep:text-ui-smaller ep:text-obs-muted">
										Checking...
									</span>
								) : semanticResult ? (
									<span
										class={cn(
											"ep:text-ui-smaller ep:font-medium",
											semanticResult.passed
												? "ep:text-obs-green"
												: "ep:text-obs-red",
										)}
									>
										{semanticResult.score}% ·{" "}
										{semanticResult.passed ? "Passed" : "Not passed"}
									</span>
								) : semanticMessage ? (
									<span class="ep:text-ui-smaller ep:text-obs-muted">
										Unavailable
									</span>
								) : (
									<span class="ep:text-ui-smaller ep:text-obs-faint">
										Not graded yet
									</span>
								)}
							</div>
							{semanticResult?.feedback && (
								<div class="ep:text-ui-smaller ep:text-obs-muted">
									{semanticResult.feedback}
								</div>
							)}
							{semanticMessage && (
								<div class="ep:text-ui-smaller ep:text-obs-muted">
									{semanticMessage}
								</div>
							)}
							{semanticResult?.source === "local-fallback" && (
								<div class="ep:text-ui-smaller ep:text-obs-faint">
									Using local fallback
								</div>
							)}
						</div>
					)}

				<CardFooter
					card={card}
					isAnswerRevealed={isAnswerRevealed}
					presetName={presetName}
					presetOptions={presetOptions}
					onPresetChange={onPresetChange}
					onOpenSourceNote={onOpenSourceNote}
				/>
			</div>
		</div>
	);
}
