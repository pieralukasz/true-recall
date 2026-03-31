import type { Grade } from "ts-fsrs";
export declare function RatingButton({ label, rating, interval, showInterval, onAnswer, disabled, }: {
    label: string;
    rating: Grade;
    interval?: string;
    showInterval: boolean;
    onAnswer: (rating: Grade) => void;
    disabled?: boolean;
}): import("preact").JSX.Element;
