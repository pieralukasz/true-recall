import type { ReviewApi } from "./types";
export declare function SummaryScreen({ review, isCustomSession, continuousCustomReviews, onClose, onNextSession, }: {
    review: ReviewApi;
    isCustomSession: boolean;
    continuousCustomReviews: boolean;
    onClose: () => void;
    onNextSession: () => void;
}): import("preact").JSX.Element;
