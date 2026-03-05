import { LivePreviewField } from "@features/study/ui/review/components/LivePreviewField";
import { PresetPopover, type PresetPickerOption } from "@features/study/ui/review/components/PresetPopover";
import { TypeInCMEditor } from "@features/study/ui/review/components/TypeInCMEditor";
import type {
	FSRSFlashcardItem,
	LocalAnswerAssessment,
	SemanticGradingResult,
} from "@shared/types";
import { Clickable } from "@shared/ui/components";
import { cn } from "@shared/ui/utils/cn";

export interface CardContainerProps {
	card: FSRSFlashcardItem;
	isAnswerRevealed: boolean;
	onContentChange: (value: string, field: "question" | "answer") => void;
	onOpenSourceNote?: () => void;
	presetName?: string;
	presetOptions?: PresetPickerOption[];
	onPresetChange?: (presetName: string) => void;
	useTypeInMode: boolean;
	aiEnabled: boolean;
	typedAnswer: string;
	onTypedAnswerChange: (value: string) => void;
	onShowAnswer: () => void;
	isCheckingAnswer: boolean;
	localAssessment: LocalAnswerAssessment | null;
	semanticResult: SemanticGradingResult | null;
	semanticMessage: string | null;
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
							// biome-ignore lint/suspicious/noArrayIndexKey: Stable for static assessment output
							key={`${token.type}-${token.text}-${index}`}
							class={cn(
								"ep:px-1.5 ep:py-0.5 ep:rounded-sm ep:text-ui-smaller",
								isMatch &&
									"ep:bg-obs-green/20 ep:text-obs-green",
								isError &&
									"ep:bg-obs-red/20 ep:text-obs-red",
								!isMatch &&
									!isError &&
									"ep:text-obs-faint",
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
	useTypeInMode,
	aiEnabled,
	typedAnswer,
	onTypedAnswerChange,
	onShowAnswer,
	isCheckingAnswer,
	localAssessment,
	semanticResult,
	semanticMessage,
}: CardContainerProps) {
	const sourcePath = card.sourceNotePath || "";

	// For cloze cards, the live-preview editor shows the cloze template
	// so users can edit {{c1::...}} syntax directly
	const questionContent =
		card.cardType === "cloze" && card.clozeTemplate
			? card.clozeTemplate
			: card.question;
	const hasTextAnswer = !!card.answer?.trim();
	const showTypeIn = useTypeInMode && hasTextAnswer;

	const expectedTokens =
		localAssessment?.diff.filter((token) => token.type !== "extra") ?? [];
	const userTokens =
		localAssessment?.diff.filter((token) => token.type !== "missing") ?? [];

	return (
		<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto ep:w-full ep:max-w-3xl ep:mx-auto">
			<div class="ep:w-full">
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

				<LivePreviewField
					content={questionContent}
					field="question"
					sourcePath={sourcePath}
					cls="true-recall-review-question ep:leading-relaxed ep:text-obs-normal ep:mb-6"
					onContentChange={onContentChange}
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
							class={cn("ep:flex ep:items-center ep:my-6", !isAnswerRevealed && "ep:hidden")}
						>
							<div class="ep:flex-1 ep:border-t ep:border-obs-border" />
						</div>
						<div class={isAnswerRevealed ? "ep:mt-6" : "ep:hidden"}>
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

				{isAnswerRevealed && localAssessment && !aiEnabled && (
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
						<TokenRow
							label="Your answer"
							tokens={userTokens}
							variant="user"
						/>
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

				{isAnswerRevealed && (card.sourceNoteName || presetName) && (
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
				)}
			</div>
		</div>
	);
}
