import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { ButtonBar, CardContainer, ReviewHeader, SummaryScreen, WaitingScreen, } from "@true-recall/obsidian/features/study/ui/review/components";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { useEffect, useLayoutEffect, useState } from "preact/hooks";
// Re-export for consumers that import from this file
export { ReviewEmptyState } from "@true-recall/obsidian/features/study/ui/review/components";
// ─── Main App ────────────────────────────────────────────────────────────────
export function ReviewApp(props) {
    var _a;
    const plugin = usePlugin();
    const review = (_a = plugin.store) === null || _a === void 0 ? void 0 : _a.getState().review;
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!plugin.store)
            return;
        return plugin.store.subscribe((state) => state.review, () => setTick((t) => t + 1));
    }, [plugin]);
    if (!review)
        return null;
    const phase = review.getPhase();
    switch (phase.type) {
        case "idle":
            return null;
        case "complete":
            return (_jsx(SummaryScreen, { review: review, isCustomSession: props.isCustomSession, continuousCustomReviews: props.continuousCustomReviews, onClose: props.onClose, onNextSession: props.onNextSession }));
        case "waiting":
            return (_jsx(WaitingScreen, { review: review, timeUntilDue: phase.timeUntilDue, onEndSession: props.onEndSession }));
        case "active":
            return _jsx(ActiveReview, Object.assign({ card: phase.card, review: review }, props));
    }
}
function ActiveReview({ card, review, onShowAnswer, onAnswer, onTypedAnswerChange, onContentChange, onOpenSourceNote, onClose: _onClose, onActionsMenu, crammingMode, showHeader, showHeaderStats, showNextReviewTime, onCycleTypeInMode, getTypeInState, getPresetName, getPresetOptions, onPresetChange, }) {
    var _a;
    const hasAnswer = !!((_a = card.answer) === null || _a === void 0 ? void 0 : _a.trim());
    const isAnswerRevealed = !hasAnswer || review.isAnswerRevealed;
    const presetName = getPresetName === null || getPresetName === void 0 ? void 0 : getPresetName(card);
    const presetOptions = getPresetOptions === null || getPresetOptions === void 0 ? void 0 : getPresetOptions();
    const typeInState = getTypeInState(card, isAnswerRevealed);
    useLayoutEffect(() => {
        if (!hasAnswer && !review.isAnswerRevealed) {
            onShowAnswer();
        }
    }, [card.id, hasAnswer, review.isAnswerRevealed, onShowAnswer]);
    return (_jsxs("div", { class: "true-recall-review ep:relative ep:flex ep:flex-col ep:h-full ep:p-0", children: [showHeader && (_jsx(ReviewHeader, { review: review, showStats: showHeaderStats, crammingMode: crammingMode })), _jsx(CardContainer, { card: card, isAnswerRevealed: isAnswerRevealed, onContentChange: onContentChange, onOpenSourceNote: onOpenSourceNote, presetName: presetName, presetOptions: presetOptions, onPresetChange: onPresetChange, typeIn: {
                    enabled: typeInState.useTypeInMode,
                    aiEnabled: typeInState.aiEnabled,
                    typedAnswer: typeInState.typedAnswer,
                    onTypedAnswerChange,
                    onShowAnswer,
                    isCheckingAnswer: typeInState.isCheckingAnswer,
                    localAssessment: typeInState.localAssessment,
                    semanticResult: typeInState.semanticResult,
                    semanticMessage: typeInState.semanticMessage,
                } }), _jsx(ButtonBar, { isAnswerRevealed: isAnswerRevealed, preview: review.getSchedulingPreview(), showNextReviewTime: showNextReviewTime, typeInMode: typeInState.typeInMode, isRatingLocked: typeInState.isRatingLocked, onShowAnswer: onShowAnswer, onAnswer: onAnswer, onCycleTypeInMode: onCycleTypeInMode, onActionsMenu: onActionsMenu })] }));
}
