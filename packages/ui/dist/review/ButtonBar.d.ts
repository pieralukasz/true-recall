import type { SchedulingPreview } from "@true-recall/core";
import type { Grade } from "ts-fsrs";
import type { TypeInMode } from "./types";
export interface ButtonBarProps {
    isAnswerRevealed: boolean;
    preview: SchedulingPreview | null;
    showNextReviewTime: boolean;
    typeInMode: TypeInMode;
    isRatingLocked: boolean;
    onShowAnswer: () => void;
    onAnswer: (rating: Grade) => void;
    onCycleTypeInMode: () => void;
    onActionsMenu: (e: MouseEvent) => void;
}
export declare function ButtonBar({ isAnswerRevealed, preview, showNextReviewTime, typeInMode, isRatingLocked, onShowAnswer, onAnswer, onCycleTypeInMode, onActionsMenu, }: ButtonBarProps): import("preact").JSX.Element;
