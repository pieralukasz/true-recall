import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "preact/jsx-runtime";
import { IOCardRenderer } from "@true-recall/obsidian/features/image-occlusion/IOCardRenderer";
import { LivePreviewField } from "@true-recall/obsidian/features/study/ui/review/components/LivePreviewField";
import { PresetPopover, } from "@true-recall/obsidian/features/study/ui/review/components/PresetPopover";
import { TypeInCMEditor } from "@true-recall/obsidian/features/study/ui/review/components/TypeInCMEditor";
import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/ui/utils/cn";
import { useEffect, useRef, useState } from "preact/hooks";
// Pre-renders the answer DOM one frame after the question paints,
// but keeps it invisible (opacity:0, height:0). Without this,
// revealing the answer causes a visible layout reflow as the
// browser measures and paints the answer content for the first time.
function useAnswerWarmup(isRevealed, cardId) {
    const warmRef = useRef(false);
    const prevCardRef = useRef(cardId);
    const [, tick] = useState(0);
    // Reset synchronously on card change (before render output)
    if (prevCardRef.current !== cardId) {
        prevCardRef.current = cardId;
        warmRef.current = false;
    }
    useEffect(() => {
        if (isRevealed || warmRef.current)
            return;
        // Wait one frame for the question to paint, then start warm-up
        const rafId = requestAnimationFrame(() => {
            warmRef.current = true;
            tick((t) => t + 1);
        });
        return () => cancelAnimationFrame(rafId);
    }, [cardId, isRevealed]);
    if (isRevealed)
        return "visible";
    if (warmRef.current)
        return "warming";
    return "hidden";
}
function CardFooter({ card, isAnswerRevealed, presetName, presetOptions, onPresetChange, onOpenSourceNote, }) {
    if (!isAnswerRevealed || (!card.sourceNoteName && !presetName))
        return null;
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:gap-4 ep:pt-8", children: [card.sourceNoteName && onOpenSourceNote && (_jsxs(Clickable, { class: "ep:text-obs-faint ep:text-ui-smaller ep:no-underline ep:hover:text-obs-accent ep:hover:underline ep:transition-colors ep:p-0", onClick: onOpenSourceNote, children: ["Source: ", card.sourceNoteName] })), presetName && presetOptions && onPresetChange ? (_jsx(PresetPopover, { value: presetName, options: presetOptions, onChange: onPresetChange })) : presetName ? (_jsxs("span", { class: "ep:text-obs-faint ep:text-ui-smaller", children: ["FSRS: ", presetName] })) : null] }));
}
function TokenRow({ label, tokens, variant, }) {
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2", children: [_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted", children: label }), _jsxs("div", { class: "ep:flex ep:flex-wrap ep:gap-1.5", children: [tokens.length === 0 && (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-faint", children: "\u2014" })), tokens.map((token, index) => {
                        const isMatch = token.type === "match";
                        const isError = variant === "expected"
                            ? token.type === "missing"
                            : token.type === "extra";
                        return (_jsx("span", { class: cn("ep:px-1.5 ep:py-0.5 ep:rounded-sm ep:text-ui-smaller", isMatch && "ep:bg-obs-green/20 ep:text-obs-green", isError && "ep:bg-obs-red/20 ep:text-obs-red", !isMatch && !isError && "ep:text-obs-faint"), children: token.text }, `${token.type}-${token.text}-${index}`));
                    })] })] }));
}
export function CardContainer({ card, isAnswerRevealed, onContentChange, onOpenSourceNote, presetName, presetOptions, onPresetChange, typeIn, }) {
    var _a, _b, _c;
    const { enabled: useTypeInMode, aiEnabled, typedAnswer, onTypedAnswerChange, onShowAnswer, isCheckingAnswer, localAssessment, semanticResult, semanticMessage, } = typeIn;
    const answerPhase = useAnswerWarmup(isAnswerRevealed, card.id);
    const sourcePath = card.sourceNotePath || "";
    const questionContent = card.question;
    const isCloze = card.cardType === "cloze";
    const hasTextAnswer = !!((_a = card.answer) === null || _a === void 0 ? void 0 : _a.trim());
    const isImageOcclusion = card.cardType === "image-occlusion" &&
        !!card.ioImagePath &&
        !!card.ioRegionsJson;
    const isAlwaysTypeIn = card.alwaysTypeIn || card.fsrs.alwaysTypeIn;
    const showTypeIn = useTypeInMode && hasTextAnswer;
    const expectedTokens = (_b = localAssessment === null || localAssessment === void 0 ? void 0 : localAssessment.diff.filter((token) => token.type !== "extra")) !== null && _b !== void 0 ? _b : [];
    const userTokens = (_c = localAssessment === null || localAssessment === void 0 ? void 0 : localAssessment.diff.filter((token) => token.type !== "missing")) !== null && _c !== void 0 ? _c : [];
    if (isImageOcclusion) {
        return (_jsx("div", { class: "true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto ep:w-full ep:max-w-3xl ep:mx-auto", children: _jsxs("div", { class: "ep:w-full", children: [_jsx(IOCardRenderer, { imagePath: card.ioImagePath, regionsJson: card.ioRegionsJson, templateOrd: card.templateOrd, revealed: isAnswerRevealed, revealSingleOnly: true }, card.id), _jsx(CardFooter, { card: card, isAnswerRevealed: isAnswerRevealed, presetName: presetName, presetOptions: presetOptions, onPresetChange: onPresetChange, onOpenSourceNote: onOpenSourceNote })] }) }));
    }
    return (_jsx("div", { class: "true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto ep:w-full ep:max-w-3xl ep:mx-auto", children: _jsxs("div", { class: "ep:w-full ep:relative", children: [card.cardType === "cloze" && card.clozeIndex !== undefined && (_jsx("div", { class: "ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider", children: `Cloze ${card.clozeIndex}` })), card.cardType === "reversed" && (_jsx("div", { class: "ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider", children: "Reversed" })), isAlwaysTypeIn && (_jsx("div", { class: "ep:text-xs ep:text-obs-accent ep:mb-2 ep:uppercase ep:tracking-wider", children: "Always type-in" })), _jsx(LivePreviewField, { content: questionContent, field: "question", sourcePath: sourcePath, cls: "true-recall-review-question ep:leading-relaxed ep:text-obs-normal ep:mb-6", onContentChange: isCloze ? undefined : onContentChange }), showTypeIn && !isAnswerRevealed && (_jsx("div", { class: "ep:mb-6", children: _jsx(TypeInCMEditor, { value: typedAnswer, onChange: onTypedAnswerChange, onSubmit: onShowAnswer, placeholderText: "Type your answer in your own words, then show answer." }) })), hasTextAnswer && (_jsxs(_Fragment, { children: [_jsx("div", { class: cn("ep:flex ep:items-center ep:my-6", !isAnswerRevealed && "ep:hidden"), children: _jsx("div", { class: "ep:flex-1 ep:border-t ep:border-obs-border" }) }), _jsx("div", { class: cn(answerPhase === "visible" && "ep:mt-6", answerPhase === "warming" &&
                                "ep:invisible ep:absolute ep:left-0 ep:right-0 ep:pointer-events-none ep:-z-10", answerPhase === "hidden" && "ep:hidden"), "aria-hidden": answerPhase !== "visible", children: _jsx(LivePreviewField, { content: card.answer, field: "answer", sourcePath: sourcePath, cls: "true-recall-review-answer ep:leading-relaxed ep:text-obs-muted", onContentChange: onContentChange }) })] })), isAnswerRevealed && localAssessment && !aiEnabled && useTypeInMode && (_jsxs("div", { class: "true-recall-answer-assessment ep:mt-8 ep:p-4 ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-secondary/20 ep:flex ep:flex-col ep:gap-3", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:gap-2", children: [_jsx("span", { class: "ep:text-ui-small ep:font-medium", children: "Text comparison" }), _jsxs("span", { class: "ep:text-ui-smaller ep:text-obs-muted", children: [localAssessment.score, "% match"] })] }), _jsx(TokenRow, { label: "Expected answer", tokens: expectedTokens, variant: "expected" }), _jsx(TokenRow, { label: "Your answer", tokens: userTokens, variant: "user" })] })), isAnswerRevealed &&
                    aiEnabled &&
                    (isCheckingAnswer || !!semanticResult || !!semanticMessage) && (_jsxs("div", { class: "true-recall-semantic-assessment ep:mt-4 ep:p-4 ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-secondary/20 ep:flex ep:flex-col ep:gap-2", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:gap-2", children: [_jsx("span", { class: "ep:text-ui-small ep:font-medium", children: "Semantic grading" }), isCheckingAnswer ? (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted", children: "Checking..." })) : semanticResult ? (_jsxs("span", { class: cn("ep:text-ui-smaller ep:font-medium", semanticResult.passed
                                        ? "ep:text-obs-green"
                                        : "ep:text-obs-red"), children: [semanticResult.score, "% \u00B7", " ", semanticResult.passed ? "Passed" : "Not passed"] })) : semanticMessage ? (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted", children: "Unavailable" })) : (_jsx("span", { class: "ep:text-ui-smaller ep:text-obs-faint", children: "Not graded yet" }))] }), (semanticResult === null || semanticResult === void 0 ? void 0 : semanticResult.feedback) && (_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: semanticResult.feedback })), semanticMessage && (_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: semanticMessage })), (semanticResult === null || semanticResult === void 0 ? void 0 : semanticResult.source) === "local-fallback" && (_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-faint", children: "Using local fallback" }))] })), _jsx(CardFooter, { card: card, isAnswerRevealed: isAnswerRevealed, presetName: presetName, presetOptions: presetOptions, onPresetChange: onPresetChange, onOpenSourceNote: onOpenSourceNote })] }) }));
}
