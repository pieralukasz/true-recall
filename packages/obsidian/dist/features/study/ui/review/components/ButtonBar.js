import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "preact/jsx-runtime";
import { RatingButton } from "@true-recall/obsidian/features/study/ui/review/components/RatingButton";
import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cva } from "class-variance-authority";
import { Rating } from "ts-fsrs";
const typeInButtonVariants = cva("ep:flex ep:items-center ep:justify-center ep:h-10 ep:px-3 ep:rounded-md ep:border ep:bg-obs-primary ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:transition-colors ep:transition-transform ep:duration-150 ep:focus-visible:outline-none ep:focus-visible:ring-2 ep:focus-visible:ring-obs-interactive/45 ep:active:scale-95", {
    variants: {
        mode: {
            ai: "ep:border-obs-interactive/45 ep:bg-obs-interactive/10 ep:text-obs-interactive ep:hover:border-obs-interactive/60 ep:hover:bg-obs-interactive/16",
            diff: "ep:border-obs-blue/35 ep:bg-obs-blue/10 ep:text-obs-blue ep:hover:border-obs-blue/45 ep:hover:bg-obs-blue/16",
            off: "ep:border-obs-border ep:hover:border-obs-modifier-border-hover ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
        },
    },
    defaultVariants: { mode: "off" },
});
export function ButtonBar({ isAnswerRevealed, preview, showNextReviewTime, typeInMode, isRatingLocked, onShowAnswer, onAnswer, onCycleTypeInMode, onActionsMenu, }) {
    const menuIconRef = useIcon("more-vertical");
    const typeInEnabled = typeInMode !== "off";
    const typeInLabel = typeInMode === "ai"
        ? "Type in · AI"
        : typeInMode === "diff"
            ? "Type in · Diff"
            : "Type in";
    const typeInCurrent = typeInMode === "ai" ? "AI" : typeInMode === "diff" ? "Diff" : "Off";
    return (_jsx("div", { class: "true-recall-review-buttons ep:relative ep:flex ep:justify-center ep:gap-3 ep:border-t ep:border-obs-border ep:flex-nowrap ep:shrink-0 ep:p-4", children: _jsxs("div", { class: "ep:flex ep:items-center ep:justify-center ep:w-full ep:relative", children: [_jsx("div", { class: "ep:flex ep:justify-center ep:gap-3 ep:flex-nowrap ep:py-4", children: !isAnswerRevealed ? (_jsx(Clickable, { stopPropagation: false, class: "ep-btn mod-cta", onClick: onShowAnswer, children: "Show answer" })) : (_jsxs(_Fragment, { children: [_jsx(RatingButton, { label: "Again", rating: Rating.Again, interval: preview === null || preview === void 0 ? void 0 : preview.again.interval, showInterval: showNextReviewTime, onAnswer: onAnswer, disabled: isRatingLocked }), _jsx(RatingButton, { label: "Hard", rating: Rating.Hard, interval: preview === null || preview === void 0 ? void 0 : preview.hard.interval, showInterval: showNextReviewTime, onAnswer: onAnswer, disabled: isRatingLocked }), _jsx(RatingButton, { label: "Good", rating: Rating.Good, interval: preview === null || preview === void 0 ? void 0 : preview.good.interval, showInterval: showNextReviewTime, onAnswer: onAnswer, disabled: isRatingLocked }), _jsx(RatingButton, { label: "Easy", rating: Rating.Easy, interval: preview === null || preview === void 0 ? void 0 : preview.easy.interval, showInterval: showNextReviewTime, onAnswer: onAnswer, disabled: isRatingLocked })] })) }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:absolute ep:right-0", children: [_jsx(Clickable, { class: typeInButtonVariants({ mode: typeInMode }), "aria-label": `Cycle type in mode (current: ${typeInCurrent})`, "aria-pressed": typeInEnabled, title: `Cycle type in mode (T) · current: ${typeInCurrent}`, onClick: onCycleTypeInMode, children: typeInLabel }), _jsx(Clickable, { class: "ep:flex ep:items-center ep:justify-center ep:w-10 ep:h-10 ep:p-0 ep:rounded-lg ep:bg-obs-modifier-hover ep:text-obs-muted ep:transition-colors ep:hover:bg-obs-border ep:hover:text-obs-normal ep:active:scale-95", "aria-label": "Card actions", onClick: onActionsMenu, children: _jsx("div", { ref: menuIconRef }) })] })] }) }));
}
