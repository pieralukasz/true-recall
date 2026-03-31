import type { ReviewApi } from "./types";
export declare function WaitingScreen({ review, timeUntilDue, onEndSession, }: {
    review: ReviewApi;
    timeUntilDue: number;
    onEndSession: () => void;
}): import("preact").JSX.Element;
